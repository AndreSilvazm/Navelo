"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq, ne } from "drizzle-orm"
import { db } from "@/db"
import { contracts, invoices } from "@/db/schema"
import { MAX_FILE_BYTES, detectMimeType, requireActiveCollaborator } from "@/lib/collaborators"
import { parseBRLToCents } from "@/lib/format"
import { IS_PRODUCTION } from "@/lib/app-env"
import { describeError } from "@/lib/diagnose"
import { invoicePath, putFile, removeFile, storageEnabled } from "@/lib/storage"

export type InvoiceState = { error?: string } | undefined

const DATE = /^\d{4}-\d{2}-\d{2}$/
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === "23505" || err?.cause?.code === "23505"
}

// Cadastra a nota fiscal. Ela nasce "em revisão": o corporativo aprova (ou recusa) e,
// depois, marca como paga.
export async function createInvoice(_: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const { session, collaborator } = await requireActiveCollaborator()

  // ---- arquivo (PDF, imagem ou XML)
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Anexe o arquivo da nota fiscal." }
  if (file.size > MAX_FILE_BYTES) return { error: "O arquivo passa de 5 MB." }
  const content = Buffer.from(await file.arrayBuffer())
  const isXml = file.name.toLowerCase().endsWith(".xml") && content.subarray(0, 200).toString("utf8").trimStart().replace(/^﻿/, "").startsWith("<")
  const mimeType = isXml ? "application/xml" : detectMimeType(content)
  if (!mimeType) return { error: "Envie a nota em PDF, XML, PNG ou JPG." }

  // ---- dados da nota (preenchidos pela leitura automática e conferidos pela pessoa)
  let number = text(formData, "number")
  if (!/^[A-Za-z0-9./-]{1,30}$/.test(number)) return { error: "Informe o número da nota (letras, números, ponto, barra ou hífen)." }
  if (/^\d+$/.test(number)) number = number.replace(/^0+(?=\d)/, "")

  const amountCents = parseBRLToCents(text(formData, "amount"))
  if (amountCents === null || Number.isNaN(amountCents) || amountCents <= 0) return { error: "Informe o valor da nota." }

  const competence = text(formData, "competence")
  if (!DATE.test(competence) || Number.isNaN(new Date(competence).getTime())) return { error: "Informe a data de competência." }

  const description = text(formData, "description")
  if (description.length > 300) return { error: "A descrição passa de 300 caracteres." }

  // ---- contrato: obrigatório quando o colaborador está em algum
  const mine = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.collaboratorId, collaborator.id), ne(contracts.status, "canceled")))
  const contractId = text(formData, "contractId")
  if (mine.length > 0 && !mine.some((c) => c.id === contractId)) return { error: "Escolha o contrato a que a nota se refere." }

  // o arquivo vai para o bucket; na linha fica só o caminho (ou o conteúdo, se o storage ainda
  // não estiver configurado)
  const id = randomUUID()
  const caminho = storageEnabled() ? invoicePath(session.company.id, collaborator.id, id, mimeType) : null
  if (caminho) {
    try {
      await putFile(caminho, content, mimeType)
    } catch (e) {
      console.error("enviar nota: storage", e)
      return { error: IS_PRODUCTION ? "Não foi possível guardar o arquivo da nota. Tente novamente em instantes." : `Não foi possível guardar o arquivo da nota: ${describeError(e)}` }
    }
  }

  try {
    await db.insert(invoices).values({
      id,
      companyId: session.company.id,
      collaboratorId: collaborator.id,
      contractId: mine.length > 0 ? contractId : null,
      number,
      amountCents,
      competence,
      description: description || null,
      fileName: file.name.slice(0, 200),
      mimeType,
      sizeBytes: content.length,
      storagePath: caminho,
      content: caminho ? null : content,
    })
  } catch (e) {
    if (caminho) await removeFile(caminho) // não deixa arquivo órfão no bucket
    if (isUniqueViolation(e)) return { error: `A nota nº ${number} já foi cadastrada por você.` }
    throw e
  }

  revalidatePath("/portal/notas-fiscais")
  revalidatePath("/app/colaboradores/[id]", "page")
  redirect("/portal/notas-fiscais")
}
