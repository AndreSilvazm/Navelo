import { desc, eq, inArray, and } from "drizzle-orm"
import { db } from "@/db"
import { invitations, users, type MembershipRole } from "@/db/schema"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { requireSession } from "@/lib/auth/session"
import { InvitationsTable, type InviteStatus } from "./invitations-table"

const fmt = (d: Date) => d.toLocaleDateString("pt-BR")

type Status = InviteStatus

// Todos os convites enviados (qualquer situação), filtrados pelos papéis da tela
export async function InvitationsHistory({ roles }: { roles: MembershipRole[] }) {
  const session = await requireSession("corporate")

  const list = await db
    .select({ invitation: invitations, invitedBy: users.name })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(and(eq(invitations.companyId, session.company.id), inArray(invitations.role, roles)))
    .orderBy(desc(invitations.createdAt))

  if (list.length === 0) return <p className="form-hint">Nenhum convite enviado ainda.</p>

  const now = new Date()
  return (
    <InvitationsTable
      rows={list.map(({ invitation: inv, invitedBy }) => {
        const status: Status = inv.acceptedAt ? "accepted" : inv.revokedAt ? "revoked" : inv.expiresAt <= now ? "expired" : "pending"
        const deadline =
          status === "pending"
            ? `Expira em ${fmt(inv.expiresAt)}`
            : status === "accepted" && inv.acceptedAt
              ? `Aceito em ${fmt(inv.acceptedAt)}`
              : status === "revoked" && inv.revokedAt
                ? `Cancelado em ${fmt(inv.revokedAt)}`
                : status === "expired"
                  ? `Expirou em ${fmt(inv.expiresAt)}`
                  : "—"
        return {
          id: inv.id,
          name: inv.name,
          email: inv.email,
          role: inv.jobTitle ?? ROLE_LABELS[inv.role],
          sentAt: fmt(inv.createdAt),
          sentBy: invitedBy,
          status,
          deadline,
        }
      })}
    />
  )
}
