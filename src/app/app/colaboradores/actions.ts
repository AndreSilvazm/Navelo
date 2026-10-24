"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaboratorStatusEvents, collaborators, invoices, type Collaborator, type CollaboratorStatus } from "@/db/schema"
import { requireSession } from "@/lib/auth/session"
import { getDocumentChecklist, readyForApproval } from "@/lib/collaborators"
import { parseBRLToCents } from "@/lib/format"

// Muda o status só se o colaborador estiver em um dos status esperados e registra no histórico
// (quem, de onde para onde, quando e por quê), tudo na mesma transação.
async function transition(input: {
  id: string
  companyId: string
  userId: string
  from: CollaboratorStatus[]
  to: CollaboratorStatus | ((c: Collaborator) => CollaboratorStatus)
  reason?: string
  set?: Partial<typeof collaborators.$inferInsert>
}) {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(collaborators)
      .where(and(eq(collaborators.id, input.id), eq(collaborators.companyId, input.companyId)))
    if (!c || !input.from.includes(c.status)) return false

    const to = typeof input.to === "function" ? input.to(c) : input.to
    const updated = await tx
      .update(collaborators)
      .set({ status: to, ...input.set })
      .where(and(eq(collaborators.id, c.id), eq(collaborators.status, c.status)))
      .returning({ id: collaborators.id })
    if (updated.length === 0) return false

    await tx.insert(collaboratorStatusEvents).values({
      collaboratorId: c.id,
      fromStatus: c.status,
      toStatus: to,
      reason: input.reason ?? null,
      byUserId: input.userId,
    })
    return true
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

  await db
    .update(collaboratorDocuments)
    .set({ status: "approved", reviewNote: null, reviewedAt: new Date(), reviewedByUserId: session.user.id })
    .where(eq(collaboratorDocuments.id, doc.id))
  refresh()
}

// Recusar devolve o colaborador para a etapa de documentos, com o motivo visível para ele
export async function rejectDocument(documentId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const note = String(formData.get("note") ?? "").trim().slice(0, 500)
  if (!note) return

  const doc = await findDocument(documentId, session.company.id)
  if (!doc || doc.collaboratorStatus !== "in_review") return

  await db.transaction(async (tx) => {
    await tx
      .update(collaboratorDocuments)
      .set({ status: "rejected", reviewNote: note, reviewedAt: new Date(), reviewedByUserId: session.user.id })
      .where(eq(collaboratorDocuments.id, doc.id))
    await tx.update(collaborators).set({ status: "documents_pending" }).where(eq(collaborators.id, doc.collaboratorId))
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

  const checklist = await getDocumentChecklist(collaborator.id, session.company.id)
  if (!readyForApproval(checklist)) return

  await transition({
    id: collaborator.id,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["in_review"],
    to: "active",
    set: { approvedAt: new Date(), approvedByUserId: session.user.id },
  })
  refresh()
}

// Recusa o acesso: vale enquanto o cadastro não foi liberado. O colaborador vê o motivo.
export async function rejectCollaborator(collaboratorId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return

  await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["profile_pending", "documents_pending", "in_review"],
    to: "rejected",
    reason,
    set: { rejectedAt: new Date(), rejectedByUserId: session.user.id, rejectionReason: reason },
  })
  refresh()
}

// Desfaz a recusa e devolve o colaborador à etapa em que estava
export async function reopenCollaborator(collaboratorId: string): Promise<void> {
  const session = await requireSession("corporate")

  await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["rejected"],
    // volta para a etapa em que estava
    to: (c) => (c.submittedAt ? "in_review" : c.profileCompletedAt ? "documents_pending" : "profile_pending"),
    set: { rejectedAt: null, rejectedByUserId: null, rejectionReason: null },
  })
  refresh()
}

// Suspende o acesso de quem já está ativo (reversível). O colaborador vê o motivo e não usa o portal.
export async function suspendCollaborator(collaboratorId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return

  await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["active"],
    to: "suspended",
    reason,
    set: { suspendedAt: new Date(), suspendedByUserId: session.user.id, suspensionReason: reason },
  })
  refresh()
}

export async function reactivateCollaborator(collaboratorId: string): Promise<void> {
  const session = await requireSession("corporate")

  await transition({
    id: collaboratorId,
    companyId: session.company.id,
    userId: session.user.id,
    from: ["suspended"],
    to: "active",
    set: { suspendedAt: null, suspendedByUserId: null, suspensionReason: null },
  })
  refresh()
}

export type AmountState = { error?: string } | undefined

const MAX_MONTHLY_CENTS = 100_000_000_00 // R$ 100 milhões: só para barrar digitação errada

// Quanto a empresa paga por mês a este colaborador. Definido pelo corporativo; vazio = sem valor.
export async function setMonthlyAmount(collaboratorId: string, formData: FormData): Promise<AmountState> {
  const session = await requireSession("corporate")

  const cents = parseBRLToCents(String(formData.get("amount") ?? ""))
  if (Number.isNaN(cents)) return { error: "Valor inválido. Use o formato 8.500,00." }
  if (cents !== null && cents > MAX_MONTHLY_CENTS) return { error: "Valor alto demais." }

  const updated = await db
    .update(collaborators)
    .set({ monthlyAmountCents: cents, monthlyAmountUpdatedAt: new Date(), monthlyAmountUpdatedByUserId: session.user.id })
    .where(and(eq(collaborators.id, collaboratorId), eq(collaborators.companyId, session.company.id)))
    .returning({ id: collaborators.id })
  if (updated.length === 0) return { error: "Colaborador não encontrado." }

  refresh()
  return {}
}

// ---- Notas fiscais: em revisão -> aprovada -> paga (ou recusada). Aprovar não é pagar.

// só mexe em nota da empresa da sessão e que esteja na situação esperada
async function moveInvoice(
  invoiceId: string,
  companyId: string,
  from: "submitted" | "approved",
  set: Partial<typeof invoices.$inferInsert>,
) {
  await db
    .update(invoices)
    .set(set)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId), eq(invoices.status, from)))
  refresh()
}

export async function approveInvoice(invoiceId: string): Promise<void> {
  const session = await requireSession("corporate")
  await moveInvoice(invoiceId, session.company.id, "submitted", {
    status: "approved",
    reviewNote: null,
    reviewedAt: new Date(),
    reviewedByUserId: session.user.id,
  })
}

export async function rejectInvoice(invoiceId: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return
  await moveInvoice(invoiceId, session.company.id, "submitted", {
    status: "rejected",
    reviewNote: reason,
    reviewedAt: new Date(),
    reviewedByUserId: session.user.id,
  })
}

// Pagamento feito: a nota passa a contar como valor pago nos dashboards
export async function markInvoicePaid(invoiceId: string): Promise<void> {
  const session = await requireSession("corporate")
  await moveInvoice(invoiceId, session.company.id, "approved", {
    status: "paid",
    paidAt: new Date(),
    paidByUserId: session.user.id,
  })
}
