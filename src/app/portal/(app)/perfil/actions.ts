"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests } from "@/db/schema"
import { normalizeAccount, validateBank } from "@/lib/bank-validation"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { auditFromSession, bankSnapshot } from "@/lib/audit"
import { bankFacts, sendBankChangeRequestedEmail } from "@/lib/email"
import { corporateContacts } from "@/lib/email/recipients"

export type BankState = { error?: string; success?: string } | undefined

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()

// O colaborador pede a troca da conta; ela só passa a valer depois que o corporativo aprovar.
// Trocar a conta de recebimento é o golpe mais comum nesse tipo de plataforma, então ninguém
// muda o destino do próprio pagamento sozinho.
export async function requestBankChange(_: BankState, formData: FormData): Promise<BankState> {
  const { collaborator, session } = await requireActiveCollaborator()

  const values = {
    bankCode: text(formData, "bankCode"),
    bankName: text(formData, "bankName"),
    bankAgency: text(formData, "bankAgency"),
    bankAccount: text(formData, "bankAccount"),
    bankAccountType: text(formData, "bankAccountType"),
    pixKey: text(formData, "pixKey"),
  }
  const error = validateBank(values)
  if (error) return { error }

  const account = normalizeAccount(values.bankAccount)
  const igual =
    collaborator.bankCode === values.bankCode &&
    collaborator.bankAgency === values.bankAgency &&
    collaborator.bankAccount === account &&
    collaborator.bankAccountType === values.bankAccountType &&
    (collaborator.pixKey ?? "") === values.pixKey
  if (igual) return { error: "Os dados enviados são iguais aos atuais." }

  const [pendente] = await db
    .select({ id: bankChangeRequests.id })
    .from(bankChangeRequests)
    .where(and(eq(bankChangeRequests.collaboratorId, collaborator.id), eq(bankChangeRequests.status, "pending")))
  if (pendente) return { error: "Você já tem um pedido em análise. Cancele-o antes de enviar outro." }

  await db.insert(bankChangeRequests).values({
    collaboratorId: collaborator.id,
    companyId: session.company.id,
    bankCode: values.bankCode,
    bankName: values.bankName.slice(0, 120),
    bankAgency: values.bankAgency,
    bankAccount: account,
    bankAccountType: values.bankAccountType as "checking" | "savings", // já validado
    pixKey: values.pixKey || null,
  })

  await auditFromSession(session, {
    action: "bank_change.requested",
    targetType: "collaborator",
    targetId: collaborator.id,
    targetLabel: collaborator.legalName,
    details: { de: bankSnapshot(collaborator), para: bankSnapshot({ ...values, bankAccount: account }) },
  })

  // avisa quem decide na empresa; o pedido não vale nada até alguém aprovar
  const destinatarios = await corporateContacts(session.company.id)
  for (const pessoa of destinatarios) {
    await sendBankChangeRequestedEmail({
      to: pessoa.email,
      name: pessoa.name,
      collaboratorName: collaborator.legalName ?? session.user.name,
      collaboratorId: collaborator.id,
      de: bankFacts(bankSnapshot(collaborator)),
      para: bankFacts(bankSnapshot({ ...values, bankAccount: account })),
    })
  }

  revalidatePath("/portal/perfil")
  revalidatePath("/app/colaboradores/[id]", "page")
  return { success: "Pedido enviado. A empresa vai analisar a troca dos dados bancários." }
}

/** O colaborador desiste do pedido enquanto ninguém o analisou */
export async function cancelBankChange(): Promise<void> {
  const { collaborator, session } = await requireActiveCollaborator()
  const apagados = await db
    .delete(bankChangeRequests)
    .where(and(eq(bankChangeRequests.collaboratorId, collaborator.id), eq(bankChangeRequests.status, "pending")))
    .returning({ id: bankChangeRequests.id })
  if (apagados.length > 0) {
    await auditFromSession(session, {
      action: "bank_change.canceled",
      targetType: "bank_change",
      targetId: apagados[0].id,
      details: { colaboradorId: collaborator.id },
    })
  }
  revalidatePath("/portal/perfil")
  revalidatePath("/app/colaboradores/[id]", "page")
}
