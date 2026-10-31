"use server"

import { revalidatePath } from "@/lib/revalidate"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { reimbursements } from "@/db/schema"
import { auditFromSession, type AuditAction } from "@/lib/audit"
import { isOwnReimbursement } from "@/lib/auth/self-review"
import { requireSession } from "@/lib/auth/session"
import { sendReimbursementEmail } from "@/lib/email"
import { collaboratorContact } from "@/lib/email/recipients"
import { categoryLabel } from "@/lib/reimbursements"

// Em revisão -> aprovado -> pago (ou recusado). Aprovar não é pagar, como na nota fiscal.
// Só mexe em pedido da empresa da sessão e que esteja na situação esperada.
async function move(
  session: Awaited<ReturnType<typeof requireSession>>,
  id: string,
  from: "submitted" | "approved",
  set: Partial<typeof reimbursements.$inferInsert>,
  action: AuditAction,
  kind: "approved" | "rejected" | "paid",
  motivo?: string,
) {
  if (await isOwnReimbursement(id, session.user.id)) return // ninguém aprova nem paga o próprio reembolso

  const [done] = await db
    .update(reimbursements)
    .set(set)
    .where(and(eq(reimbursements.id, id), eq(reimbursements.companyId, session.company.id), eq(reimbursements.status, from)))
    .returning({
      description: reimbursements.description,
      category: reimbursements.category,
      amountCents: reimbursements.amountCents,
      collaboratorId: reimbursements.collaboratorId,
    })
  if (!done) return

  await auditFromSession(session, {
    action,
    targetType: "reimbursement",
    targetId: id,
    targetLabel: `${categoryLabel(done.category)}: ${done.description}`.slice(0, 100),
    details: { de: from, valorCentavos: done.amountCents, colaboradorId: done.collaboratorId, ...(motivo ? { motivo } : {}) },
  })

  const contato = await collaboratorContact(done.collaboratorId)
  if (contato) {
    await sendReimbursementEmail({ ...contato, kind, descricao: done.description, valorCentavos: done.amountCents, motivo })
  }
  revalidatePath("/app/reembolsos")
  revalidatePath("/portal/reembolsos")
  revalidatePath("/app/colaboradores/[id]", "page")
}

export async function approveReimbursement(id: string): Promise<void> {
  const session = await requireSession("corporate")
  await move(session, id, "submitted", { status: "approved", reviewNote: null, reviewedAt: new Date(), reviewedByUserId: session.user.id }, "reimbursement.approved", "approved")
}

export async function rejectReimbursement(id: string, formData: FormData): Promise<void> {
  const session = await requireSession("corporate")
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500)
  if (!reason) return
  await move(session, id, "submitted", { status: "rejected", reviewNote: reason, reviewedAt: new Date(), reviewedByUserId: session.user.id }, "reimbursement.rejected", "rejected", reason)
}

// Pagamento feito: o valor passa a contar como gasto pago no dashboard do colaborador
export async function markReimbursementPaid(id: string): Promise<void> {
  const session = await requireSession("corporate")
  await move(session, id, "approved", { status: "paid", paidAt: new Date(), paidByUserId: session.user.id }, "reimbursement.paid", "paid")
}
