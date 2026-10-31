"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { randomUUID } from "node:crypto"
import { collaborators, contractFiles, contractRequirements, contracts, memberships } from "@/db/schema"
import { IS_PRODUCTION } from "@/lib/app-env"
import { auditFromSession } from "@/lib/audit"
import { CORPORATE_ROLES, requireSession } from "@/lib/auth/session"
import { MAX_FILE_BYTES, detectMimeType } from "@/lib/collaborators"
import { describeError } from "@/lib/diagnose"
import { contractFilePath, putFile, removeFile, storageEnabled } from "@/lib/storage"
import { parseBRLToCents } from "@/lib/format"

export type ContractFormValues = {
  name: string
  description: string
  responsibleUserId: string
  startDate: string
  endDate: string
  amount: string
  invoiceDueDay: string
  collaboratorId: string
  docs: { name: string; required: boolean }[]
}
export type ContractState = { error?: string; values?: ContractFormValues } | undefined

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DOCS = 20

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === "23505" || err?.cause?.code === "23505"
}

// a violação veio do índice "um contrato ativo por colaborador" (e não do nome repetido)?
function isCollaboratorKey(e: unknown): boolean {
  const err = e as { constraint_name?: string; cause?: { constraint_name?: string } }
  return (err?.constraint_name ?? err?.cause?.constraint_name) === "contracts_collaborator_key"
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()

type ContractFields = Pick<
  ContractFormValues,
  "name" | "description" | "responsibleUserId" | "startDate" | "endDate" | "amount" | "invoiceDueDay"
>

const readFields = (formData: FormData): ContractFields => ({
  name: text(formData, "name"),
  description: text(formData, "description"),
  responsibleUserId: text(formData, "responsibleUserId"),
  startDate: text(formData, "startDate"),
  endDate: text(formData, "endDate"),
  amount: text(formData, "amount"),
  invoiceDueDay: text(formData, "invoiceDueDay"),
})

// Valida os dados do contrato (usado ao criar e ao editar).
// Valor e término são opcionais: contrato sem prazo, ou com valor ainda desconhecido, é normal.
async function parseContractFields(values: ContractFields, companyId: string) {
  if (values.name.length < 2) return { ok: false as const, error: "Informe o nome do contrato." }
  if (!DATE.test(values.startDate)) return { ok: false as const, error: "Informe a data de início." }
  if (values.endDate && !DATE.test(values.endDate)) return { ok: false as const, error: "Data de término inválida." }
  if (values.endDate && values.endDate < values.startDate) return { ok: false as const, error: "O término não pode ser antes do início." }

  const amountCents = parseBRLToCents(values.amount)
  if (Number.isNaN(amountCents)) return { ok: false as const, error: "Valor inválido." }

  // prazo mensal de envio das NFs (opcional): dia 1 a 31
  let invoiceDueDay: number | null = null
  if (values.invoiceDueDay) {
    invoiceDueDay = Number(values.invoiceDueDay)
    if (!Number.isInteger(invoiceDueDay) || invoiceDueDay < 1 || invoiceDueDay > 31) return { ok: false as const, error: "Dia de envio das notas fiscais inválido." }
  }

  // responsável precisa ser da equipe corporativa desta empresa
  let responsibleUserId: string | null = null
  if (values.responsibleUserId) {
    const [member] = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.companyId, companyId),
          eq(memberships.userId, values.responsibleUserId),
          eq(memberships.status, "active"),
          inArray(memberships.role, [...CORPORATE_ROLES]),
        ),
      )
    if (!member) return { ok: false as const, error: "Responsável inválido." }
    responsibleUserId = member.userId
  }

  return { ok: true as const, data: { amountCents, invoiceDueDay, responsibleUserId } }
}

export async function createContract(_: ContractState, formData: FormData): Promise<ContractState> {
  const session = await requireSession("corporate")

  // documentos vêm em listas paralelas (nome[i] ↔ obrigatório[i])
  const docNames = formData.getAll("docName").map((v) => String(v).trim())
  const docRequired = formData.getAll("docRequired").map((v) => String(v) === "1")
  const values: ContractFormValues = {
    name: text(formData, "name"),
    description: text(formData, "description"),
    responsibleUserId: text(formData, "responsibleUserId"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
    amount: text(formData, "amount"),
    invoiceDueDay: text(formData, "invoiceDueDay"),
    collaboratorId: text(formData, "collaboratorId"),
    docs: docNames.map((name, i) => ({ name, required: docRequired[i] ?? true })),
  }
  const fail = (error: string): ContractState => ({ error, values })

  const parsed = await parseContractFields(values, session.company.id)
  if (!parsed.ok) return fail(parsed.error)
  const { amountCents, invoiceDueDay, responsibleUserId } = parsed.data

  const docs = values.docs.filter((d) => d.name)
  if (docs.length > MAX_DOCS) return fail(`No máximo ${MAX_DOCS} documentos por contrato.`)
  if (docs.some((d) => d.name.length > 120)) return fail("Nome de documento muito longo.")

  // o contrato é de UM colaborador: ativo, desta empresa e sem outro contrato ativo
  if (!values.collaboratorId) return fail("Escolha o colaborador do contrato.")
  const [collaborator] = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(and(eq(collaborators.id, values.collaboratorId), eq(collaborators.companyId, session.company.id), eq(collaborators.status, "active")))
  if (!collaborator) return fail("Colaborador inválido: só vale quem está ativo nesta empresa.")
  const [already] = await db
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.collaboratorId, collaborator.id), eq(contracts.status, "active")))
  if (already) return fail("Esse colaborador já tem um contrato ativo. Encerre o atual antes de criar outro.")

  let contractId: string
  try {
    contractId = await db.transaction(async (tx) => {
      const [contract] = await tx
        .insert(contracts)
        .values({
          companyId: session.company.id,
          name: values.name.slice(0, 120),
          description: values.description.slice(0, 200) || null,
          startDate: values.startDate,
          endDate: values.endDate || null,
          amountCents,
          invoiceDueDay,
          responsibleUserId,
          createdByUserId: session.user.id,
          collaboratorId: collaborator.id,
        })
        .returning({ id: contracts.id })

      if (docs.length)
        await tx.insert(contractRequirements).values(docs.map((d) => ({ contractId: contract.id, name: d.name, required: d.required })))

      return contract.id
    })
  } catch (e) {
    if (isUniqueViolation(e)) return fail(isCollaboratorKey(e) ? "Esse colaborador já tem um contrato ativo." : "Já existe um contrato com esse nome.")
    throw e
  }

  revalidatePath("/app/contratos")
  redirect(`/app/contratos/${contractId}`)
}

// Contrato da empresa da sessão (e ainda não cancelado)
async function ownContract(contractId: string, companyId: string) {
  const [c] = await db
    .select({ id: contracts.id, status: contracts.status })
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.companyId, companyId)))
  return c && c.status !== "canceled" ? c : null
}

export type EditState = { error?: string; success?: string } | undefined

// Edita os dados do contrato (inclusive definir o valor depois, ou deixá-lo "a definir")
export async function updateContract(contractId: string, _: EditState, formData: FormData): Promise<EditState> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return { error: "Contrato não encontrado ou cancelado." }

  const values = readFields(formData)
  const parsed = await parseContractFields(values, session.company.id)
  if (!parsed.ok) return { error: parsed.error }

  try {
    await db
      .update(contracts)
      .set({
        name: values.name.slice(0, 120),
        description: values.description.slice(0, 200) || null,
        startDate: values.startDate,
        endDate: values.endDate || null,
        amountCents: parsed.data.amountCents,
        invoiceDueDay: parsed.data.invoiceDueDay,
        responsibleUserId: parsed.data.responsibleUserId,
      })
      .where(and(eq(contracts.id, contractId), eq(contracts.companyId, session.company.id)))
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Já existe um contrato com esse nome." }
    throw e
  }

  revalidatePath(`/app/contratos/${contractId}`)
  revalidatePath("/app/contratos")
  return { success: "Dados do contrato atualizados." }
}

// Documentos exigidos só neste contrato: dá para acrescentar e remover depois de criado
export async function addContractRequirement(contractId: string, _: EditState, formData: FormData): Promise<EditState> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return { error: "Contrato não encontrado ou cancelado." }

  const name = text(formData, "name")
  if (name.length < 2) return { error: "Informe o nome do documento." }
  if (name.length > 120) return { error: "Nome de documento muito longo." }

  const existing = await db.select({ id: contractRequirements.id }).from(contractRequirements).where(eq(contractRequirements.contractId, contractId))
  if (existing.length >= MAX_DOCS) return { error: `No máximo ${MAX_DOCS} documentos por contrato.` }

  await db.insert(contractRequirements).values({ contractId, name, required: formData.get("required") === "on" })

  revalidatePath(`/app/contratos/${contractId}`)
  return { success: "Documento adicionado." }
}

export async function removeContractRequirement(contractId: string, requirementId: string): Promise<void> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return

  await db
    .delete(contractRequirements)
    .where(and(eq(contractRequirements.id, requirementId), eq(contractRequirements.contractId, contractId)))

  revalidatePath(`/app/contratos/${contractId}`)
}

// Encerrar: o contrato sai de vigência, fica no histórico e libera o colaborador para um novo
export async function endContract(contractId: string): Promise<void> {
  const session = await requireSession("corporate")
  const [done] = await db
    .update(contracts)
    .set({ status: "ended" })
    .where(and(eq(contracts.id, contractId), eq(contracts.companyId, session.company.id), eq(contracts.status, "active")))
    .returning({ id: contracts.id, name: contracts.name })
  if (!done) return

  await auditFromSession(session, { action: "contract.ended", targetType: "contract", targetId: contractId, targetLabel: done.name })
  revalidatePath(`/app/contratos/${contractId}`)
  revalidatePath("/app/contratos")
}

// ---- Arquivos do contrato (só o corporativo anexa e vê)

export type FileState = { error?: string; success?: string } | undefined
const MAX_CONTRACT_FILES = 30

export async function uploadContractFile(contractId: string, _: FileState, formData: FormData): Promise<FileState> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return { error: "Contrato não encontrado." }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Anexe o arquivo." }
  if (file.size > MAX_FILE_BYTES) return { error: "O arquivo passa de 5 MB." }
  const content = Buffer.from(await file.arrayBuffer())
  const mimeType = detectMimeType(content)
  if (!mimeType) return { error: "Envie um PDF, PNG ou JPG." }

  const title = (text(formData, "title") || file.name.replace(/\.[^.]+$/, "")).slice(0, 120)
  if (title.length < 2) return { error: "Dê um nome ao documento." }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(contractFiles).where(eq(contractFiles.contractId, contractId))
  if (n >= MAX_CONTRACT_FILES) return { error: `No máximo ${MAX_CONTRACT_FILES} arquivos por contrato.` }
  if (!storageEnabled()) return { error: "O armazenamento de arquivos não está configurado neste ambiente." }

  const id = randomUUID()
  const path = contractFilePath(session.company.id, contractId, id, mimeType)
  try {
    await putFile(path, content, mimeType)
  } catch (e) {
    console.error("uploadContractFile: storage", e)
    return { error: IS_PRODUCTION ? "Não foi possível guardar o arquivo. Tente novamente em instantes." : `Não foi possível guardar o arquivo: ${describeError(e)}` }
  }

  try {
    await db.insert(contractFiles).values({
      id,
      companyId: session.company.id,
      contractId,
      title,
      fileName: file.name.slice(0, 200),
      mimeType,
      sizeBytes: content.length,
      storagePath: path,
      uploadedByUserId: session.user.id,
    })
  } catch (e) {
    await removeFile(path) // não deixa arquivo órfão no bucket
    throw e
  }

  await auditFromSession(session, { action: "contract_file.uploaded", targetType: "contract_file", targetId: id, targetLabel: title, details: { contratoId: contractId, arquivo: file.name } })
  revalidatePath(`/app/contratos/${contractId}`)
  return { success: "Arquivo anexado." }
}

export async function deleteContractFile(contractId: string, fileId: string): Promise<void> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return

  const [gone] = await db
    .delete(contractFiles)
    .where(and(eq(contractFiles.id, fileId), eq(contractFiles.contractId, contractId), eq(contractFiles.companyId, session.company.id)))
    .returning({ title: contractFiles.title, storagePath: contractFiles.storagePath })
  if (!gone) return

  await removeFile(gone.storagePath)
  await auditFromSession(session, { action: "contract_file.deleted", targetType: "contract_file", targetId: fileId, targetLabel: gone.title, details: { contratoId: contractId } })
  revalidatePath(`/app/contratos/${contractId}`)
}
