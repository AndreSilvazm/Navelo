"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contractCollaborators, contractRequirements, contracts, memberships } from "@/db/schema"
import { CORPORATE_ROLES, requireSession } from "@/lib/auth/session"
import { parseBRLToCents } from "@/lib/format"

export type ContractFormValues = {
  name: string
  description: string
  responsibleUserId: string
  startDate: string
  endDate: string
  amount: string
  invoiceDueDay: string
  collaboratorIds: string[]
  docs: { name: string; required: boolean }[]
}
export type ContractState = { error?: string; values?: ContractFormValues } | undefined

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DOCS = 20

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === "23505" || err?.cause?.code === "23505"
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
    collaboratorIds: formData.getAll("collaboratorIds").map(String),
    docs: docNames.map((name, i) => ({ name, required: docRequired[i] ?? true })),
  }
  const fail = (error: string): ContractState => ({ error, values })

  const parsed = await parseContractFields(values, session.company.id)
  if (!parsed.ok) return fail(parsed.error)
  const { amountCents, invoiceDueDay, responsibleUserId } = parsed.data

  const docs = values.docs.filter((d) => d.name)
  if (docs.length > MAX_DOCS) return fail(`No máximo ${MAX_DOCS} documentos por contrato.`)
  if (docs.some((d) => d.name.length > 120)) return fail("Nome de documento muito longo.")

  // só colaboradores ativos desta empresa entram no contrato
  const collaboratorIds = values.collaboratorIds.length
    ? (
        await db
          .select({ id: collaborators.id })
          .from(collaborators)
          .where(
            and(
              eq(collaborators.companyId, session.company.id),
              eq(collaborators.status, "active"),
              inArray(collaborators.id, values.collaboratorIds),
            ),
          )
      ).map((c) => c.id)
    : []

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
        })
        .returning({ id: contracts.id })

      if (collaboratorIds.length)
        await tx.insert(contractCollaborators).values(collaboratorIds.map((collaboratorId) => ({ contractId: contract.id, collaboratorId })))
      if (docs.length)
        await tx.insert(contractRequirements).values(docs.map((d) => ({ contractId: contract.id, name: d.name, required: d.required })))

      return contract.id
    })
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe um contrato com esse nome.")
    throw e
  }

  revalidatePath("/app/contratos")
  redirect(`/app/contratos/${contractId}`)
}

export type MembersState = { error?: string; success?: string } | undefined

// Contrato da empresa da sessão (e ainda não cancelado)
async function ownContract(contractId: string, companyId: string) {
  const [c] = await db
    .select({ id: contracts.id, status: contracts.status })
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.companyId, companyId)))
  return c && c.status !== "canceled" ? c : null
}

// Depois de criado, o contrato pode receber mais colaboradores
export async function addContractCollaborators(contractId: string, _: MembersState, formData: FormData): Promise<MembersState> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return { error: "Contrato não encontrado." }

  const requested = formData.getAll("collaboratorIds").map(String)
  if (requested.length === 0) return { error: "Selecione ao menos um colaborador." }

  // só colaboradores ativos desta empresa
  const valid = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(
      and(
        eq(collaborators.companyId, session.company.id),
        eq(collaborators.status, "active"),
        inArray(collaborators.id, requested),
      ),
    )
  if (valid.length === 0) return { error: "Nenhum dos colaboradores selecionados está ativo." }

  await db
    .insert(contractCollaborators)
    .values(valid.map((c) => ({ contractId, collaboratorId: c.id })))
    .onConflictDoNothing({ target: [contractCollaborators.contractId, contractCollaborators.collaboratorId] })

  revalidatePath(`/app/contratos/${contractId}`)
  revalidatePath("/app/contratos")
  return { success: `${valid.length} colaborador(es) adicionado(s) ao contrato.` }
}

export async function removeContractCollaborator(contractId: string, collaboratorId: string): Promise<void> {
  const session = await requireSession("corporate")
  if (!(await ownContract(contractId, session.company.id))) return

  await db
    .delete(contractCollaborators)
    .where(and(eq(contractCollaborators.contractId, contractId), eq(contractCollaborators.collaboratorId, collaboratorId)))

  revalidatePath(`/app/contratos/${contractId}`)
  revalidatePath("/app/contratos")
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
