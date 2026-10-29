import "server-only"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests, collaboratorStatusEvents, collaborators, contractCollaborators, contracts, invitations, invoices, memberships, users } from "@/db/schema"
import { getDocumentChecklist } from "@/lib/collaborators"
import type { CollaboratorDetailData } from "./types"

const iso = (d: Date | null) => (d ? d.toISOString() : null)

// Dados + documentos do colaborador em uma ida ao banco (as duas consultas rodam juntas)
export async function getCollaboratorDetail(companyId: string, id: string, viewerUserId: string): Promise<CollaboratorDetailData | null> {
  const [rows, checklist, linkedContracts, events, invoiceRows, bankPending] = await Promise.all([
    db
      .select({
        c: collaborators,
        name: users.name,
        email: users.email,
        userId: memberships.userId,
        approvedBy: sql<string | null>`(select u.name from users u where u.id = ${collaborators.approvedByUserId})`,
        rejectedBy: sql<string | null>`(select u.name from users u where u.id = ${collaborators.rejectedByUserId})`,
        suspendedBy: sql<string | null>`(select u.name from users u where u.id = ${collaborators.suspendedByUserId})`,
        amountBy: sql<string | null>`(select u.name from users u where u.id = ${collaborators.monthlyAmountUpdatedByUserId})`,
      })
      .from(collaborators)
      .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(collaborators.id, id), eq(collaborators.companyId, companyId))),
    getDocumentChecklist(id, companyId),
    // contratos em que o colaborador está (a empresa vem do próprio contrato)
    db
      .select({
        id: contracts.id,
        name: contracts.name,
        status: contracts.status,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        linkedAt: contractCollaborators.createdAt,
      })
      .from(contractCollaborators)
      .innerJoin(contracts, eq(contracts.id, contractCollaborators.contractId))
      .where(and(eq(contractCollaborators.collaboratorId, id), eq(contracts.companyId, companyId)))
      .orderBy(contractCollaborators.createdAt),
    // histórico de mudanças de status (a empresa vem do próprio colaborador)
    db
      .select({
        id: collaboratorStatusEvents.id,
        from: collaboratorStatusEvents.fromStatus,
        to: collaboratorStatusEvents.toStatus,
        reason: collaboratorStatusEvents.reason,
        by: users.name,
        at: collaboratorStatusEvents.createdAt,
      })
      .from(collaboratorStatusEvents)
      .innerJoin(collaborators, eq(collaborators.id, collaboratorStatusEvents.collaboratorId))
      .leftJoin(users, eq(users.id, collaboratorStatusEvents.byUserId))
      .where(and(eq(collaboratorStatusEvents.collaboratorId, id), eq(collaborators.companyId, companyId)))
      .orderBy(desc(collaboratorStatusEvents.createdAt)),
    // notas fiscais do colaborador (sem o arquivo: ele vem pela rota própria)
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        amountCents: invoices.amountCents,
        competence: invoices.competence,
        description: invoices.description,
        status: invoices.status,
        contractName: contracts.name,
        fileName: invoices.fileName,
        mimeType: invoices.mimeType,
        createdAt: invoices.createdAt,
        reviewedAt: invoices.reviewedAt,
        reviewNote: invoices.reviewNote,
        paidAt: invoices.paidAt,
        reviewedBy: sql<string | null>`(select u.name from users u where u.id = ${invoices.reviewedByUserId})`,
        paidBy: sql<string | null>`(select u.name from users u where u.id = ${invoices.paidByUserId})`,
      })
      .from(invoices)
      .leftJoin(contracts, eq(contracts.id, invoices.contractId))
      .where(and(eq(invoices.collaboratorId, id), eq(invoices.companyId, companyId)))
      .orderBy(desc(invoices.competence), desc(invoices.createdAt)),
    // troca de conta bancária esperando decisão
    db
      .select({
        id: bankChangeRequests.id,
        bankCode: bankChangeRequests.bankCode,
        bankName: bankChangeRequests.bankName,
        bankAgency: bankChangeRequests.bankAgency,
        bankAccount: bankChangeRequests.bankAccount,
        bankAccountType: bankChangeRequests.bankAccountType,
        pixKey: bankChangeRequests.pixKey,
        createdAt: bankChangeRequests.createdAt,
      })
      .from(bankChangeRequests)
      .where(and(eq(bankChangeRequests.collaboratorId, id), eq(bankChangeRequests.status, "pending")))
      .limit(1),
  ])

  const row = rows[0]
  if (!row) return null
  const { c } = row

  // convite que originou este cadastro (quem convidou e quando)
  const [invite] = await db
    .select({ createdAt: invitations.createdAt, acceptedAt: invitations.acceptedAt, invitedBy: users.name })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(
      and(
        eq(invitations.companyId, companyId),
        eq(invitations.acceptedByUserId, row.userId),
        eq(invitations.role, "collaborator"),
      ),
    )
    .orderBy(desc(invitations.acceptedAt))
    .limit(1)

  return {
    id: c.id,
    status: c.status,
    // é a própria pessoa que está olhando: ela não decide sobre o próprio cadastro
    isSelf: row.userId === viewerUserId,
    pendingBankChange: bankPending[0]
      ? { ...bankPending[0], pixKey: bankPending[0].pixKey, createdAt: bankPending[0].createdAt.toISOString() }
      : null,
    name: row.name,
    email: row.email,
    jobTitle: c.jobTitle,
    legalName: c.legalName,
    tradeName: c.tradeName,
    cnpj: c.cnpj,
    phone: c.phone,
    zipCode: c.zipCode,
    street: c.street,
    number: c.number,
    complement: c.complement,
    district: c.district,
    city: c.city,
    state: c.state,
    createdAt: c.createdAt.toISOString(),
    profileCompletedAt: iso(c.profileCompletedAt),
    submittedAt: iso(c.submittedAt),
    approvedAt: iso(c.approvedAt),
    approvedBy: row.approvedBy,
    bankCode: c.bankCode,
    bankName: c.bankName,
    bankAgency: c.bankAgency,
    bankAccount: c.bankAccount,
    bankAccountType: c.bankAccountType,
    pixKey: c.pixKey,
    invitedAt: iso(invite?.createdAt ?? null),
    invitedBy: invite?.invitedBy ?? null,
    inviteAcceptedAt: iso(invite?.acceptedAt ?? null),
    rejectedAt: iso(c.rejectedAt),
    rejectedBy: row.rejectedBy,
    rejectionReason: c.rejectionReason,
    suspendedAt: iso(c.suspendedAt),
    suspendedBy: row.suspendedBy,
    suspensionReason: c.suspensionReason,
    history: events.map((e) => ({ ...e, at: e.at.toISOString() })),
    invoices: invoiceRows.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      reviewedAt: iso(i.reviewedAt),
      paidAt: iso(i.paidAt),
    })),
    monthlyAmountCents: c.monthlyAmountCents,
    monthlyAmountUpdatedAt: iso(c.monthlyAmountUpdatedAt),
    monthlyAmountUpdatedBy: row.amountBy,
    contracts: linkedContracts.map((k) => ({ ...k, linkedAt: k.linkedAt.toISOString() })),
    checklist: checklist.map(({ requirement, document }) => ({
      requirement,
      document: document ? { ...document, uploadedAt: document.uploadedAt.toISOString(), reviewedAt: iso(document.reviewedAt) } : null,
    })),
  }
}
