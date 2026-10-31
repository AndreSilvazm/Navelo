"use server"

import { revalidatePath } from "@/lib/revalidate"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests, collaboratorDocuments, collaboratorStatusEvents, collaborators, invoices, memberships, type Collaborator, type CollaboratorStatus } from "@/db/schema"
import { requireSession } from "@/lib/auth/session"
import { auditFromSession, bankSnapshot, type AuditAction } from "@/lib/audit"
import { SELF_REVIEW_ERROR, isOwnCollaboratorRecord, isOwnInvoice } from "@/lib/auth/self-review"
import { syncBankData } from "@/lib/collaborator-join"
import {
  bankFacts,
  sendBankChangeApprovedEmail,
  sendBankChangeRejectedEmail,
  sendCollaboratorApprovedEmail,
  sendCollaboratorRejectedEmail,
  sendInvoiceApprovedEmail,
  sendInvoicePaidEmail,
  sendInvoiceRejectedEmail,
} from "@/lib/email"
import { collaboratorContact } from "@/lib/email/recipients"
import { getDocumentChecklist, readyForApproval } from "@/lib/collaborators"
import { parseBRLToCents } from "@/lib/format"
import { competenceLabel } from "@/lib/invoice-status"

// Muda o status só se o colaborador estiver em um dos status esperados e registra no histórico
// (quem, de onde para onde, quando e por quê), tudo na mesma transação.
async function transition(input: {
  id: string
  companyId: string
  userId: string
  /** ação registrada na trilha de auditoria */
  audit?: AuditAction
  from: CollaboratorStatus[]
  to: CollaboratorStatus | ((c: Collaborator) => CollaboratorStatus)
  reason?: string
  set?: Partial<typeof collaborators.$inferInsert>
}) {
  if (await isOwnCollaboratorRecord(input.id, input.userId)) return null

  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(collaborators)
      .where(and(eq(collaborators.id, input.id), eq(collaborators.companyId, input.companyId)))
    if (!c || !input.from.includes(c.status)) return null

    const to = typeof input.to === "function" ? input.to(c) : input.to
    const updated = await tx
      .update(collaborators)
      .set({ status: to, ...input.set })
      .where(and(eq(collaborators.id, c.id), eq(collaborators.status, c.status)))
      .returning({ id: collaborators.id })
    if (updated.length === 0) return null

    await tx.insert(collaboratorStatusEvents).values({
      collaboratorId: c.id,
      fromStatus: c.status,
      toStatus: to,
      reason: input.reason ?? null,
      byUserId: input.userId,
    })
    return { de: c.status, para: to, nome: c.legalName }
  })
}

// Registra na trilha a decisão tomada sobre o cadastro
async function auditTransition(
  session: Awaited<ReturnType<typeof requireSession>>,
  action: AuditAction,
  collaboratorId: string,
  result: { de: string; para: string; nome: string | null } | null,
  extra: Record<string, unknown> = {},
) {
  if (!result) return
  await auditFromSession(session, {
    action,
    targetType: "collaborator",
    targetId: collaboratorId,
    targetLabel: result.nome,
    details: { de: result.de, para: result.para, ...extra },
  })
}

function refresh() {
  revalidatePath("/app/colaboradores")
  revalidatePath("/portal/primeiro-acesso")
}

// Documento + colaborador só valem se forem da empresa da sessão
async function findDocument(documentId: string, companyId: string) {
  const [row] = await db
    .select({ id: collaboratorDocuments.id, collaboratorId: collaborators.id, collaboratorStatus: collaborators.status })
    .from(collaboratorDocuments)
    .innerJoin(collaborators, eq(collaborators.id, collaboratorDocuments.collaboratorId))
    .where(and(eq(collaboratorDocuments.id, documentId), eq(collaborators.companyId, companyId)))
  return row
}

export async function approveDocument(documentId: string): Promise<void> {
  const session = await requireSession("corporate")
  const doc = await findDocument(documentId, session.company.id)
  if (!doc || doc.collaboratorStatus !== "in_review") return
  if (await isOwnCollaboratorRecord(doc.collaboratorId, session.user.id)) return

  await db
    .update(collaboratorDocuments)
    .set({ status: "approved", reviewNote: null, reviewedAt: new Date(), reviewedByUserId: session.user.id })
    .where(eq(collaboratorDocuments.id, doc.id))
  await auditFromSession(session, {
    action: "document.approved",
    targetType: "document",
    targetId: doc.id,
    details: { colaboradorId: doc.collaboratorId },
  })
  refresh()
}

// Recusar devolve o colaborador para a etapa de documentos, com o motivo visível para ele
export async function rejectDocument(documentId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const note = String(formData.get("note") ?? "").trim().slice(0, 500)
  if (!note) return

  const doc = await findDocument(documentId, session.company.id)
  if (!doc || doc.collaboratorStatus !== "in_review") return
  if (await isOwnCollaboratorRecord(doc.collaboratorId, session.user.id)) return

  await db.transaction(async (tx) => {
    await tx
      .update(collaboratorDocuments)
      .set({ status: "rejected", reviewNote: note, reviewedAt: new Date(), reviewedByUserId: session.user.id })
      .where(eq(collaboratorDocuments.id, doc.id))
    await tx.update(collaborators).set({ status: "documents_pending" }).where(eq(collaborators.id, doc.collaboratorId))
  })
  await auditFromSession(session, {
    action: "document.rejected",
    targetType: "document",
    targetId: doc.id,
    details: { colaboradorId: doc.collaboratorId, motivo: note },
  })
  refresh()
}

// Libera o acesso: análise → ativo. Exige todos os documentos obrigatórios aprovados.
export async function approveCollaborator(collaboratorId: string): Promise<void> {
  const session = await requireSession("corporate")

  const [collaborator] = await db
    .select()
    .from(collaborators)
    .where(and(eq(collaborators.id, collaboratorId), eq(collaborators.companyId, session.company.id)))
  if (!collaborator || collaborator.status !== "in_review") return
  if (await isOwnCollaboratorRecord(collaborator.id, session.user.id)) return

  const checklist = await getDocumentChecklist(collaborator.id, session.company.id)
  if (!readyForApproval(checklist)) return

  const resultado = await transition({
    id: collaborator.id,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["in_review"],
    to: "active",
    set: { approvedAt: new Date(), approvedByUserId: session.user.id },
  })
  await auditTransition(session, "collaborator.approved", collaborator.id, resultado)
  if (resultado) {
    const contato = await collaboratorContact(collaborator.id)
    if (contato) await sendCollaboratorApprovedEmail(contato)
  }
  refresh()
}

// Recusa o acesso: vale enquanto o cadastro não foi liberado. O colaborador vê o motivo.
export async function rejectCollaborator(collaboratorId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return

  const resultado = await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["profile_pending", "documents_pending", "in_review"],
    to: "rejected",
    reason,
    set: { rejectedAt: new Date(), rejectedByUserId: session.user.id, rejectionReason: reason },
  })
  await auditTransition(session, "collaborator.rejected", collaboratorId, resultado, { motivo: reason })
  if (resultado) {
    const contato = await collaboratorContact(collaboratorId)
    if (contato) await sendCollaboratorRejectedEmail({ ...contato, motivo: reason })
  }
  refresh()
}

// Desfaz a recusa e devolve o colaborador à etapa em que estava
export async function reopenCollaborator(collaboratorId: string): Promise<void> {
  const session = await requireSession("corporate")

  const resultado = await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["rejected"],
    // volta para a etapa em que estava
    to: (c) => (c.submittedAt ? "in_review" : c.profileCompletedAt ? "documents_pending" : "profile_pending"),
    set: { rejectedAt: null, rejectedByUserId: null, rejectionReason: null },
  })
  await auditTransition(session, "collaborator.reopened", collaboratorId, resultado)
  refresh()
}

// Suspende o acesso de quem já está ativo (reversível). O colaborador vê o motivo e não usa o portal.
export async function suspendCollaborator(collaboratorId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return

  const resultado = await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["active"],
    to: "suspended",
    reason,
    set: { suspendedAt: new Date(), suspendedByUserId: session.user.id, suspensionReason: reason },
  })
  await auditTransition(session, "collaborator.suspended", collaboratorId, resultado, { motivo: reason })
  refresh()
}

export async function reactivateCollaborator(collaboratorId: string): Promise<void> {
  const session = await requireSession("corporate")

  const resultado = await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["suspended"],
    to: "active",
    set: { suspendedAt: null, suspendedByUserId: null, suspensionReason: null },
  })
  await auditTransition(session, "collaborator.reactivated", collaboratorId, resultado)
  refresh()
}

export type AmountState = { error?: string } | undefined

const MAX_MONTHLY_CENTS = 100_000_000_00 // R$ 100 milhões: só para barrar digitação errada

// Quanto a empresa paga por mês a este colaborador. Definido pelo corporativo; vazio = sem valor.
export async function setMonthlyAmount(collaboratorId: string, formData: FormData): Promise<AmountState> {
  const session = await requireSession("corporate")

  if (await isOwnCollaboratorRecord(collaboratorId, session.user.id)) return { error: SELF_REVIEW_ERROR }

  const [anterior] = await db
    .select({ monthlyAmountCents: collaborators.monthlyAmountCents })
    .from(collaborators)
    .where(and(eq(collaborators.id, collaboratorId), eq(collaborators.companyId, session.company.id)))

  const cents = parseBRLToCents(String(formData.get("amount") ?? ""))
  if (Number.isNaN(cents)) return { error: "Valor inválido. Use o formato 8.500,00." }
  if (cents !== null && cents > MAX_MONTHLY_CENTS) return { error: "Valor alto demais." }

  const updated = await db
    .update(collaborators)
    .set({ monthlyAmountCents: cents, monthlyAmountUpdatedAt: new Date(), monthlyAmountUpdatedByUserId: session.user.id })
    .where(and(eq(collaborators.id, collaboratorId), eq(collaborators.companyId, session.company.id)))
    .returning({ id: collaborators.id })
  if (updated.length === 0) return { error: "Colaborador não encontrado." }

  await auditFromSession(session, {
    action: "collaborator.amount_changed",
    targetType: "collaborator",
    targetId: collaboratorId,
    details: { de: anterior?.monthlyAmountCents ?? null, para: cents },
  })
  refresh()
  return {}
}

// ---- Notas fiscais: em revisão -> aprovada -> paga (ou recusada). Aprovar não é pagar.

// só mexe em nota da empresa da sessão e que esteja na situação esperada
async function moveInvoice(
  session: Awaited<ReturnType<typeof requireSession>>,
  invoiceId: string,
  from: "submitted" | "approved",
  set: Partial<typeof invoices.$inferInsert>,
  action: AuditAction,
  extra: Record<string, unknown> = {},
) {
  if (await isOwnInvoice(invoiceId, session.user.id)) return // ninguém aprova nem paga a própria nota

  const [atualizada] = await db
    .update(invoices)
    .set(set)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, session.company.id), eq(invoices.status, from)))
    .returning({ number: invoices.number, amountCents: invoices.amountCents, competence: invoices.competence, collaboratorId: invoices.collaboratorId })
  if (!atualizada) return

  await auditFromSession(session, {
    action,
    targetType: "invoice",
    targetId: invoiceId,
    targetLabel: `nº ${atualizada.number}`,
    details: { de: from, valorCentavos: atualizada.amountCents, colaboradorId: atualizada.collaboratorId, ...extra },
  })

  const contato = await collaboratorContact(atualizada.collaboratorId)
  if (contato) {
    const base = {
      ...contato,
      numero: atualizada.number,
      competencia: competenceLabel(atualizada.competence),
      valorCentavos: atualizada.amountCents,
    }
    if (action === "invoice.approved") await sendInvoiceApprovedEmail(base)
    if (action === "invoice.paid") await sendInvoicePaidEmail(base)
    if (action === "invoice.rejected") await sendInvoiceRejectedEmail({ ...base, motivo: String(extra.motivo ?? "") })
  }
  refresh()
}

export async function approveInvoice(invoiceId: string): Promise<void> {
  const session = await requireSession("corporate")
  await moveInvoice(
    session,
    invoiceId,
    "submitted",
    { status: "approved", reviewNote: null, reviewedAt: new Date(), reviewedByUserId: session.user.id },
    "invoice.approved",
  )
}

export async function rejectInvoice(invoiceId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return
  await moveInvoice(
    session,
    invoiceId,
    "submitted",
    { status: "rejected", reviewNote: reason, reviewedAt: new Date(), reviewedByUserId: session.user.id },
    "invoice.rejected",
    { motivo: reason },
  )
}

// Pagamento feito: a nota passa a contar como valor pago nos dashboards
export async function markInvoicePaid(invoiceId: string): Promise<void> {
  const session = await requireSession("corporate")
  await moveInvoice(
    session,
    invoiceId,
    "approved",
    { status: "paid", paidAt: new Date(), paidByUserId: session.user.id },
    "invoice.paid",
  )
}

// ---- Troca de dados bancários pedida pelo colaborador (só vale depois de aprovada)

async function findBankRequest(requestId: string, companyId: string) {
  const [row] = await db
    .select()
    .from(bankChangeRequests)
    .where(
      and(
        eq(bankChangeRequests.id, requestId),
        eq(bankChangeRequests.companyId, companyId),
        eq(bankChangeRequests.status, "pending"),
      ),
    )
  return row
}

// Aprovar aplica a conta nova. Como a conta é única da pessoa, vale em todas as empresas dela.
export async function approveBankChange(requestId: string): Promise<void> {
  const session = await requireSession("corporate")
  const pedido = await findBankRequest(requestId, session.company.id)
  if (!pedido) return
  if (await isOwnCollaboratorRecord(pedido.collaboratorId, session.user.id)) return // ninguém aprova a própria conta

  const [vinculo] = await db
    .select({ userId: memberships.userId })
    .from(collaborators)
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .where(eq(collaborators.id, pedido.collaboratorId))
  if (!vinculo) return

  const [anterior] = await db.select().from(collaborators).where(eq(collaborators.id, pedido.collaboratorId))

  await db
    .update(bankChangeRequests)
    .set({ status: "approved", reviewedAt: new Date(), reviewedByUserId: session.user.id })
    .where(and(eq(bankChangeRequests.id, pedido.id), eq(bankChangeRequests.status, "pending")))

  await syncBankData(vinculo.userId, {
    bankCode: pedido.bankCode,
    bankName: pedido.bankName,
    bankAgency: pedido.bankAgency,
    bankAccount: pedido.bankAccount,
    bankAccountType: pedido.bankAccountType,
    pixKey: pedido.pixKey,
  })

  await auditFromSession(session, {
    action: "bank_change.approved",
    targetType: "bank_change",
    targetId: pedido.id,
    targetLabel: anterior?.legalName ?? null,
    details: {
      colaboradorId: pedido.collaboratorId,
      de: bankSnapshot(anterior ?? {}),
      para: bankSnapshot(pedido),
      valeEmTodasAsEmpresasDaPessoa: true,
    },
  })

  const contato = await collaboratorContact(pedido.collaboratorId)
  if (contato) await sendBankChangeApprovedEmail({ ...contato, conta: bankFacts(bankSnapshot(pedido)) })
  refresh()
  revalidatePath("/portal/perfil")
}

export async function rejectBankChange(requestId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return

  const pedido = await findBankRequest(requestId, session.company.id)
  if (!pedido) return
  if (await isOwnCollaboratorRecord(pedido.collaboratorId, session.user.id)) return

  await db
    .update(bankChangeRequests)
    .set({ status: "rejected", reviewNote: reason, reviewedAt: new Date(), reviewedByUserId: session.user.id })
    .where(and(eq(bankChangeRequests.id, pedido.id), eq(bankChangeRequests.status, "pending")))

  await auditFromSession(session, {
    action: "bank_change.rejected",
    targetType: "bank_change",
    targetId: pedido.id,
    details: { colaboradorId: pedido.collaboratorId, motivo: reason, recusado: bankSnapshot(pedido) },
  })

  const contato = await collaboratorContact(pedido.collaboratorId)
  if (contato) await sendBankChangeRejectedEmail({ ...contato, motivo: reason })
  refresh()
  revalidatePath("/portal/perfil")
}
