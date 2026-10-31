"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "@/lib/revalidate"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { contracts, reimbursementFiles, reimbursements } from "@/db/schema"
import { IS_PRODUCTION } from "@/lib/app-env"
import { MAX_FILE_BYTES, detectMimeType, requireActiveCollaborator } from "@/lib/collaborators"
import { describeError } from "@/lib/diagnose"
import { parseBRLToCents } from "@/lib/format"
import { MAX_RECEIPTS, isCategory } from "@/lib/reimbursements"
import { putFile, reimbursementFilePath, removeFile, storageEnabled } from "@/lib/storage"

export type ReimbursementState = { error?: string } | undefined

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TOTAL_BYTES = 25 * 1024 * 1024
const MAX_AMOUNT_CENTS = 100_000_000 // R$ 1.000.000,00: acima disso é provavelmente erro de digitação
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) // AAAA-MM-DD

// Pedido de reembolso: nasce "em revisão" e SÓ vale com pelo menos um comprovante anexado.
// O corporativo aprova (ou recusa) e depois marca como pago.
export async function createReimbursement(_: ReimbursementState, formData: FormData): Promise<ReimbursementState> {
  const { session, collaborator } = await requireActiveCollaborator()

  // ---- dados da despesa
  const category = text(formData, "category")
  if (!isCategory(category)) return { error: "Escolha a categoria da despesa." }

  const description = text(formData, "description")
  if (description.length < 5) return { error: "Descreva a despesa (o que foi e por quê), com pelo menos 5 caracteres." }
  if (description.length > 300) return { error: "A descrição passa de 300 caracteres." }

  const merchant = text(formData, "merchant")
  const trip = text(formData, "trip")
  if (merchant.length > 120) return { error: "O nome do estabelecimento passa de 120 caracteres." }
  if (trip.length > 120) return { error: "O nome da viagem ou projeto passa de 120 caracteres." }

  const amountCents = parseBRLToCents(text(formData, "amount"))
  if (amountCents === null || Number.isNaN(amountCents) || amountCents <= 0) return { error: "Informe o valor da despesa." }
  if (amountCents > MAX_AMOUNT_CENTS) return { error: "O valor passa de R$ 1.000.000,00. Confira se não houve erro de digitação." }

  const expenseDate = text(formData, "expenseDate")
  if (!DATE.test(expenseDate) || Number.isNaN(new Date(expenseDate).getTime())) return { error: "Informe a data da despesa." }
  const hoje = today()
  if (expenseDate > hoje) return { error: "A data da despesa não pode ser no futuro." }
  const limite = new Date(`${hoje}T00:00:00Z`)
  limite.setUTCFullYear(limite.getUTCFullYear() - 1)
  if (expenseDate < limite.toISOString().slice(0, 10)) return { error: "A despesa tem mais de 1 ano. Fale com a empresa para pedir esse reembolso." }

  // ---- comprovantes: obrigatórios
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return { error: "Anexe pelo menos um comprovante da despesa (nota, recibo ou cupom)." }
  if (files.length > MAX_RECEIPTS) return { error: `No máximo ${MAX_RECEIPTS} comprovantes por pedido.` }

  const staged: { id: string; name: string; mimeType: string; content: Buffer }[] = []
  let total = 0
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) return { error: `“${file.name}” passa de 5 MB.` }
    const content = Buffer.from(await file.arrayBuffer())
    const mimeType = detectMimeType(content)
    if (!mimeType) return { error: `“${file.name}”: envie PDF, PNG ou JPG.` }
    total += content.length
    if (total > MAX_TOTAL_BYTES) return { error: "O total dos comprovantes passa de 25 MB." }
    staged.push({ id: randomUUID(), name: file.name.slice(0, 200), mimeType, content })
  }

  if (!storageEnabled()) return { error: "O armazenamento de arquivos não está configurado neste ambiente. Avise a empresa." }

  // contrato ativo do colaborador (para os relatórios do corporativo); sem contrato, fica em branco
  const [contract] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.collaboratorId, collaborator.id), eq(contracts.status, "active")))

  // ---- os arquivos vão para o bucket antes; se algo falhar, nada fica registrado
  const id = randomUUID()
  const uploaded: string[] = []
  try {
    for (const f of staged) {
      const path = reimbursementFilePath(session.company.id, collaborator.id, id, f.id, f.mimeType)
      await putFile(path, f.content, f.mimeType)
      uploaded.push(path)
    }
  } catch (e) {
    console.error("createReimbursement: storage", e)
    for (const path of uploaded) await removeFile(path)
    return { error: IS_PRODUCTION ? "Não foi possível guardar os comprovantes. Tente novamente em instantes." : `Não foi possível guardar os comprovantes: ${describeError(e)}` }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(reimbursements).values({
        id,
        companyId: session.company.id,
        collaboratorId: collaborator.id,
        contractId: contract?.id ?? null,
        category,
        description,
        merchant: merchant || null,
        trip: trip || null,
        expenseDate,
        amountCents,
      })
      await tx.insert(reimbursementFiles).values(
        staged.map((f, i) => ({
          id: f.id,
          companyId: session.company.id,
          reimbursementId: id,
          fileName: f.name,
          mimeType: f.mimeType,
          sizeBytes: f.content.length,
          storagePath: uploaded[i],
        })),
      )
    })
  } catch (e) {
    console.error("createReimbursement: banco", e)
    for (const path of uploaded) await removeFile(path) // não deixa arquivo órfão no bucket
    return { error: IS_PRODUCTION ? "Não foi possível registrar o pedido. Tente novamente em instantes." : `Não foi possível registrar o pedido: ${describeError(e)}` }
  }

  revalidatePath("/portal/reembolsos")
  revalidatePath("/app/reembolsos")
  redirect("/portal/reembolsos")
}
