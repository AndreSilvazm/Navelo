"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaborators } from "@/db/schema"
import { validateBank, normalizeAccount } from "@/lib/bank-validation"
import { UFS } from "@/lib/br-states"
import { isValidCnpj, onlyDigits } from "@/lib/cnpj"
import { COMPANY_FIELDS, fetchCompanyProfile } from "@/lib/cnpj-lookup"
import { syncBankData } from "@/lib/collaborator-join"
import { documentPath, putFile, storageEnabled } from "@/lib/storage"
import {
  MAX_FILE_BYTES,
  detectMimeType,
  getDocumentChecklist,
  requireOnboardingCollaborator,
} from "@/lib/collaborators"

export type ProfileState = { error?: string; values?: Record<string, string> } | undefined
export type FormState = { error?: string; success?: string } | undefined

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === "23505" || err?.cause?.code === "23505"
}

// Etapa 1: dados da empresa do colaborador
export async function saveProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const { session, collaborator } = await requireOnboardingCollaborator()
  if (collaborator.status === "in_review") return { error: "Seus dados estão em análise e não podem ser alterados agora." }
  if (collaborator.status === "rejected") return { error: "Seu acesso foi recusado e o cadastro não pode ser alterado." }
  if (collaborator.status === "suspended") return { error: "Seu acesso está suspenso e o cadastro não pode ser alterado." }

  const values: Record<string, string> = {
    legalName: text(formData, "legalName"),
    tradeName: text(formData, "tradeName"),
    cnpj: text(formData, "cnpj"),
    phone: text(formData, "phone"),
    zipCode: text(formData, "zipCode"),
    street: text(formData, "street"),
    number: text(formData, "number"),
    complement: text(formData, "complement"),
    district: text(formData, "district"),
    city: text(formData, "city"),
    state: text(formData, "state").toUpperCase(),
    bankCode: text(formData, "bankCode"),
    bankName: text(formData, "bankName"),
    bankAgency: text(formData, "bankAgency"),
    bankAccount: text(formData, "bankAccount"),
    bankAccountType: text(formData, "bankAccountType"),
    pixKey: text(formData, "pixKey"),
  }
  const fail = (error: string): ProfileState => ({ error, values })

  // o CNPJ não muda depois do primeiro cadastro: vale o que já está salvo
  const cnpj = collaborator.cnpj ?? onlyDigits(values.cnpj)
  if (!isValidCnpj(cnpj)) return fail("CNPJ inválido.")

  // Dados da empresa vêm da Receita Federal, não do formulário: o que a Receita informa
  // não pode ser alterado pelo colaborador (vale o dado dela, mesmo que o navegador envie outro).
  // Só o que a Receita não traz (por exemplo, telefone) é aceito do formulário.
  const receita = await fetchCompanyProfile(cnpj)
  if (receita.status === "not_found") return fail("CNPJ não encontrado na Receita Federal. Confira o número.")
  if (receita.status !== "ok") return fail("Não foi possível consultar a Receita Federal agora. Tente novamente em instantes.")
  for (const field of COMPANY_FIELDS) {
    if (receita.data[field]) values[field] = receita.data[field]
  }
  values.cnpj = cnpj

  const phone = onlyDigits(values.phone)
  const zipCode = onlyDigits(values.zipCode)

  if (values.legalName.length < 2) return fail("Informe a razão social.")
  if (phone.length < 10 || phone.length > 11) return fail("Informe um telefone com DDD.")
  if (zipCode.length !== 8) return fail("CEP inválido.")
  if (!values.street || !values.number || !values.district || !values.city) return fail("Preencha o endereço completo.")
  if (!(UFS as readonly string[]).includes(values.state)) return fail("Escolha o estado.")

  // dados bancários: a conta é da empresa (CNPJ), para pagamentos
  const bankError = validateBank(values as Parameters<typeof validateBank>[0])
  if (bankError) return fail(bankError)

  try {
    await db
      .update(collaborators)
      .set({
        legalName: values.legalName,
        tradeName: values.tradeName || null,
        cnpj,
        phone,
        zipCode,
        street: values.street,
        number: values.number,
        complement: values.complement || null,
        district: values.district,
        city: values.city,
        state: values.state,
        bankCode: values.bankCode,
        bankName: values.bankName.slice(0, 120),
        bankAgency: values.bankAgency,
        bankAccount: normalizeAccount(values.bankAccount),
        bankAccountType: values.bankAccountType as "checking" | "savings", // já validado por validateBank
        pixKey: values.pixKey || null,
        profileCompletedAt: new Date(),
        // avança só na primeira vez; quem já está enviando documentos permanece onde está
        status: collaborator.status === "profile_pending" ? "documents_pending" : collaborator.status,
      })
      .where(eq(collaborators.id, collaborator.id))
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe um colaborador com esse CNPJ nesta empresa.")
    throw e
  }

  // a conta bancária é única da pessoa: vale em todas as empresas dela
  await syncBankData(session.user.id, {
    bankCode: values.bankCode,
    bankName: values.bankName.slice(0, 120),
    bankAgency: values.bankAgency,
    bankAccount: normalizeAccount(values.bankAccount),
    bankAccountType: values.bankAccountType as "checking" | "savings",
    pixKey: values.pixKey || null,
  })

  revalidatePath("/portal/primeiro-acesso")
  redirect("/portal/primeiro-acesso")
}

// Etapas 2 e 3: o colaborador anexa todos os documentos e envia de uma vez para análise
const MAX_TOTAL_BYTES = 25 * 1024 * 1024

export async function submitDocuments(_: FormState, formData: FormData): Promise<FormState> {
  const { session, collaborator } = await requireOnboardingCollaborator()
  if (collaborator.status !== "documents_pending") return { error: "O envio de documentos não está disponível agora." }

  const checklist = await getDocumentChecklist(collaborator.id, session.company.id)

  // lê e valida todos os arquivos antes de gravar qualquer coisa
  const staged: { requirementId: string; fileName: string; mimeType: string; content: Buffer }[] = []
  let total = 0
  for (const { requirement, document } of checklist) {
    if (document?.status === "approved") continue // o que já foi aprovado não é substituído
    const file = formData.get(`doc_${requirement.id}`)
    if (!(file instanceof File) || file.size === 0) continue

    if (file.size > MAX_FILE_BYTES) return { error: `“${requirement.name}” passa de 5 MB.` }
    const content = Buffer.from(await file.arrayBuffer())
    const mimeType = detectMimeType(content)
    if (!mimeType) return { error: `“${requirement.name}”: envie um PDF, PNG ou JPG.` }
    total += content.length
    if (total > MAX_TOTAL_BYTES) return { error: "O total dos arquivos passa de 25 MB." }
    staged.push({ requirementId: requirement.id, fileName: file.name.slice(0, 200), mimeType, content })
  }

  const stagedIds = new Set(staged.map((s) => s.requirementId))
  const missing = checklist.filter(
    ({ requirement, document }) =>
      requirement.required && !stagedIds.has(requirement.id) && (!document || document.status === "rejected"),
  )
  if (missing.length > 0) return { error: `Faltam documentos obrigatórios: ${missing.map((m) => m.requirement.name).join(", ")}.` }

  // sobe os arquivos para o bucket antes de gravar: se algum falhar, nada é registrado
  const enviados = new Map<string, string>()
  if (storageEnabled()) {
    for (const s of staged) {
      const caminho = documentPath(collaborator.companyId, collaborator.id, s.requirementId, s.mimeType)
      await putFile(caminho, s.content, s.mimeType)
      enviados.set(s.requirementId, caminho)
    }
  }

  await db.transaction(async (tx) => {
    for (const s of staged) {
      const caminho = enviados.get(s.requirementId) ?? null
      const data = {
        fileName: s.fileName,
        mimeType: s.mimeType,
        sizeBytes: s.content.length,
        storagePath: caminho,
        content: caminho ? null : s.content,
        status: "submitted" as const,
        reviewNote: null,
        reviewedAt: null,
        reviewedByUserId: null,
        uploadedAt: new Date(),
      }
      await tx
        .insert(collaboratorDocuments)
        .values({ collaboratorId: collaborator.id, requirementId: s.requirementId, ...data })
        .onConflictDoUpdate({
          target: [collaboratorDocuments.collaboratorId, collaboratorDocuments.requirementId],
          set: data,
        })
    }
    await tx
      .update(collaborators)
      .set({ status: "in_review", submittedAt: new Date() })
      .where(and(eq(collaborators.id, collaborator.id), eq(collaborators.status, "documents_pending")))
  })

  revalidatePath("/app/colaboradores")
  redirect("/portal/primeiro-acesso")
}
