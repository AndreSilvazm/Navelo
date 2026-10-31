"use server"

import { revalidatePath } from "@/lib/revalidate"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaborators } from "@/db/schema"
import { validateBank, normalizeAccount } from "@/lib/bank-validation"
import { UFS } from "@/lib/br-states"
import { isValidCnpj, onlyDigits } from "@/lib/cnpj"
import { COMPANY_FIELDS, fetchCompanyProfile } from "@/lib/cnpj-lookup"
import { getBankAccounts, removeBankAccount, saveBankAccount } from "@/lib/bank-accounts"
import { IS_PRODUCTION } from "@/lib/app-env"
import { describeError } from "@/lib/diagnose"
import { documentPath, putFile, removeFile, storageEnabled } from "@/lib/storage"
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

// Etapa 1: dados da empresa do colaborador (os dados bancários são a etapa 2)
export async function saveProfile(_: ProfileState, formData: FormData): Promise<ProfileState> {
  const { collaborator } = await requireOnboardingCollaborator()
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
        profileCompletedAt: new Date(),
        // avança só na primeira vez; quem já está enviando documentos permanece onde está
        status: collaborator.status === "profile_pending" ? "documents_pending" : collaborator.status,
      })
      .where(eq(collaborators.id, collaborator.id))
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe um colaborador com esse CNPJ nesta empresa.")
    throw e
  }

  revalidatePath("/portal/primeiro-acesso")
  redirect("/portal/primeiro-acesso")
}

// Etapa 2: dados bancários. A conta PJ (da empresa) é obrigatória; a conta pessoa física é opcional e,
// quem não quiser agora, pode informar depois pelo perfil. As contas moram na tabela bank_accounts
// (uma por pessoa e tipo) e valem em todas as empresas dela.
export type BankStepState = { error?: string; values?: Record<string, string> } | undefined

const BANK_FIELDS = ["bankCode", "bankName", "bankAgency", "bankAccount", "bankAccountType", "pixKey"] as const

function readBank(formData: FormData, prefix: string) {
  return Object.fromEntries(BANK_FIELDS.map((k) => [k, text(formData, `${prefix}${k}`)])) as Record<(typeof BANK_FIELDS)[number], string>
}

export async function saveBankStep(_: BankStepState, formData: FormData): Promise<BankStepState> {
  const { session, collaborator } = await requireOnboardingCollaborator()
  if (collaborator.status !== "documents_pending") return { error: "Esta etapa não está disponível agora." }

  const pj = readBank(formData, "")
  const withPf = formData.get("pfEnabled") === "on"
  const pf = readBank(formData, "pf_")
  const values: Record<string, string> = { ...pj, pfEnabled: withPf ? "on" : "", ...Object.fromEntries(BANK_FIELDS.map((k) => [`pf_${k}`, pf[k]])) }
  const fail = (error: string): BankStepState => ({ error, values })

  // a conta da empresa é obrigatória
  const pjError = validateBank(pj)
  if (pjError) return fail(`Conta PJ: ${pjError}`)
  // a conta pessoal só é validada se a pessoa quis informá-la
  if (withPf) {
    const pfError = validateBank(pf)
    if (pfError) return fail(`Conta pessoa física: ${pfError}`)
  }

  const asData = (v: typeof pj) => ({
    bankCode: v.bankCode,
    bankName: v.bankName.slice(0, 120),
    bankAgency: v.bankAgency,
    bankAccount: normalizeAccount(v.bankAccount),
    bankAccountType: v.bankAccountType as "checking" | "savings", // já validado por validateBank
    pixKey: v.pixKey || null,
  })
  await saveBankAccount(session.user.id, "pj", asData(pj))
  if (withPf) await saveBankAccount(session.user.id, "pf", asData(pf))
  else await removeBankAccount(session.user.id, "pf") // desmarcou: nada de conta pessoal guardada

  revalidatePath("/portal/primeiro-acesso")
  redirect("/portal/primeiro-acesso")
}

// Etapas 2 e 3: o colaborador anexa todos os documentos e envia de uma vez para análise
const MAX_TOTAL_BYTES = 25 * 1024 * 1024

export async function submitDocuments(_: FormState, formData: FormData): Promise<FormState> {
  const { session, collaborator } = await requireOnboardingCollaborator()
  if (collaborator.status !== "documents_pending") return { error: "O envio de documentos não está disponível agora." }
  // a etapa dos dados bancários vem antes: sem a conta PJ não há como enviar para análise
  if (!(await getBankAccounts(session.user.id)).pj) return { error: "Informe primeiro os dados bancários (etapa 2)." }

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
  try {
    if (storageEnabled()) {
      for (const s of staged) {
        const caminho = documentPath(collaborator.companyId, collaborator.id, s.requirementId, s.mimeType)
        await putFile(caminho, s.content, s.mimeType)
        enviados.set(s.requirementId, caminho)
      }
    }
  } catch (e) {
    console.error("submitDocuments: storage", e)
    for (const caminho of enviados.values()) await removeFile(caminho) // não deixa arquivo órfão
    // fora de produção a tela mostra a causa; em produção, uma mensagem genérica
    return { error: IS_PRODUCTION ? "Não foi possível guardar os arquivos. Tente novamente em instantes." : `Não foi possível guardar os arquivos: ${describeError(e)}` }
  }

  try {
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
  } catch (e) {
    console.error("submitDocuments: banco", e)
    for (const caminho of enviados.values()) await removeFile(caminho)
    return { error: IS_PRODUCTION ? "Não foi possível registrar os documentos. Tente novamente em instantes." : `Não foi possível registrar os documentos: ${describeError(e)}` }
  }

  revalidatePath("/app/colaboradores")
  redirect("/portal/primeiro-acesso")
}
