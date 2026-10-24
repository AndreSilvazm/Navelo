import { desc, eq, inArray, and } from "drizzle-orm"
import { db } from "@/db"
import { invitations, users, type MembershipRole } from "@/db/schema"
import { Badge, Button } from "@/figma/ui"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { requireSession } from "@/lib/auth/session"
import { resendInvitation, revokeInvitation } from "./actions"

const fmt = (d: Date) => d.toLocaleDateString("pt-BR")

type Status = "pending" | "accepted" | "revoked" | "expired"
const label: Record<Status, string> = { pending: "Pendente", accepted: "Aceito", revoked: "Cancelado", expired: "Expirado" }
const tone = { pending: "warning", accepted: "success", revoked: "neutral", expired: "danger" } as const

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
    <div className="invite-table-wrap">
      <table className="invite-table">
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Cargo</th>
            <th>Enviado em</th>
            <th>Situação</th>
            <th>Prazo</th>
            <th aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {list.map(({ invitation: inv, invitedBy }) => {
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
            return (
              <tr key={inv.id}>
                <td>
                  <strong>{inv.email}</strong>
                </td>
                <td>{inv.jobTitle ?? ROLE_LABELS[inv.role]}</td>
                <td>
                  {fmt(inv.createdAt)}
                  {invitedBy && <small className="cell-sub">por {invitedBy}</small>}
                </td>
                <td>
                  <Badge tone={tone[status]}>{label[status]}</Badge>
                </td>
                <td>{deadline}</td>
                <td>
                  <div className="invite-actions">
                    {(status === "pending" || status === "expired") && (
                      <form action={resendInvitation.bind(null, inv.id)}>
                        <Button type="submit" variant="secondary">
                          Reenviar
                        </Button>
                      </form>
                    )}
                    {status === "pending" && (
                      <form action={revokeInvitation.bind(null, inv.id)}>
                        <Button type="submit" variant="ghost">
                          Cancelar
                        </Button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
