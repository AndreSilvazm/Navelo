"use server"

import { revalidatePath } from "@/lib/revalidate"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests } from "@/db/schema"
import { normalizeAccount, validateBank } from "@/lib/bank-validation"
import { KIND_LABEL, getBankAccounts, isBankKind } from "@/lib/bank-accounts"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { auditFromSession, bankSnapshot } from "@/lib/audit"
import { bankFacts, sendBankChangeRequestedEmail } from "@/lib/email"
import { corporateContacts } from "@/lib/email/recipients"

export type BankState = { error?: string; success?: string } | undefined

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()

// O colaborador pede a troca de uma das contas (PJ ou pessoa física) ou o cadastro da conta pessoal; só
// passa a valer depois que o corporativo aprovar. Trocar a conta de recebimento é o golpe mais comum
// nesse tipo de plataforma, então ninguém muda o destino do próprio pagamento sozinho.
export async function requestBankChange(_: BankState, formData: FormData): Promise<BankState> {
  const { collaborator, session } = await requireActiveCollaborator()

  const kind = text(formData, "kind")
  if (!isBankKind(kind)) return { error: "Tipo de conta inválido." }

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

  const atual = (await getBankAccounts(session.user.id))[kind]
  const account = normalizeAccount(values.bankAccount)
  const igual =
    !!atual &&
    atual.bankCode === values.bankCode &&
    atual.bankAgency === values.bankAgency &&
    atual.bankAccount === account &&
    atual.bankAccountType === values.bankAccountType &&
    (atual.pixKey ?? "") === values.pixKey
  if (igual) return { error: "Os dados enviados são iguais aos atuais." }

  const [pendente] = await db
    .select({ id: bankChangeRequests.id })
    .from(bankChangeRequests)
    .where(and(eq(bankChangeRequests.collaboratorId, collaborator.id), eq(bankChangeRequests.kind, kind), eq(bankChangeRequests.status, "pending")))
  if (pendente) return { error: "Você já tem um pedido em análise para esta conta. Cancele-o antes de enviar outro." }

  await db.insert(bankChangeRequests).values({
    collaboratorId: collaborator.id,
    companyId: session.company.id,
    kind,
    bankCode: values.bankCode,
    bankName: values.bankName.slice(0, 120),
    bankAgency: values.bankAgency,
    bankAccount: account,
    bankAccountType: values.bankAccountType as "checking" | "savings", // já validado
    pixKey: values.pixKey || null,
  })

  const nova = !atual
  const para = bankSnapshot({ ...values, bankAccount: account })
  await auditFromSession(session, {
    action: "bank_change.requested",
    targetType: "collaborator",
    targetId: collaborator.id,
    targetLabel: collaborator.legalName,
    details: { tipo: KIND_LABEL[kind], nova, de: atual ? bankSnapshot(atual) : null, para },
  })

  // avisa quem decide na empresa; o pedido não vale nada até alguém aprovar
  const destinatarios = await corporateContacts(session.company.id)
  for (const pessoa of destinatarios) {
    await sendBankChangeRequestedEmail({
      to: pessoa.email,
      name: pessoa.name,
      collaboratorName: collaborator.legalName ?? session.user.name,
      collaboratorId: collaborator.id,
      tipo: KIND_LABEL[kind].toLowerCase(),
      nova,
      de: bankFacts(atual ? bankSnapshot(atual) : {}),
      para: bankFacts(para),
    })
  }

  revalidatePath("/portal/perfil")
  revalidatePath("/app/colaboradores/[id]", "page")
  return {
    success: nova
      ? "Pedido enviado. A empresa vai analisar o cadastro desta conta."
      : "Pedido enviado. A empresa vai analisar a troca dos dados bancários.",
  }
}

/** O colaborador desiste do pedido (de um tipo de conta) enquanto ninguém o analisou */
export async function cancelBankChange(kind: string): Promise<void> {
  const { collaborator, session } = await requireActiveCollaborator()
  if (!isBankKind(kind)) return
  const apagados = await db
    .delete(bankChangeRequests)
    .where(and(eq(bankChangeRequests.collaboratorId, collaborator.id), eq(bankChangeRequests.kind, kind), eq(bankChangeRequests.status, "pending")))
    .returning({ id: bankChangeRequests.id })
  if (apagados.length > 0) {
    await auditFromSession(session, {
      action: "bank_change.canceled",
      targetType: "bank_change",
      targetId: apagados[0].id,
      details: { colaboradorId: collaborator.id, tipo: KIND_LABEL[kind] },
    })
  }
  revalidatePath("/portal/perfil")
  revalidatePath("/app/colaboradores/[id]", "page")
}
