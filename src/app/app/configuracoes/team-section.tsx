import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { memberships, users } from "@/db/schema"
import { Badge, Card } from "@/figma/ui"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { CORPORATE_ROLES, requireSession } from "@/lib/auth/session"
import { InviteForm } from "../_invites/invite-form"
import { InvitationsHistory } from "../_invites/invitations-history"

const row = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" } as const

// Equipe da conta corporativa. Colaboradores PJ são convidados em /app/colaboradores.
export async function TeamSection() {
  const session = await requireSession("corporate")

  const members = await db
    .select({ id: memberships.id, role: memberships.role, name: users.name, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.companyId, session.company.id),
        eq(memberships.status, "active"),
        inArray(memberships.role, [...CORPORATE_ROLES]),
      ),
    )
    .orderBy(asc(users.name))

  return (
    <div className="mvp-settings-grid" style={{ marginTop: 24 }}>
      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Convidar administrador ou agente</strong>
            <span>Quem vai gerenciar a conta da empresa no Navelo. A pessoa preenche os próprios dados ao aceitar.</span>
          </div>
        </div>
        <InviteForm roles={["admin", "agent"]} submitLabel="Enviar convite" />
        <div style={{ marginTop: 24 }}>
          <InvitationsHistory roles={["admin", "agent"]} />
        </div>
      </Card>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Equipe da empresa</strong>
            <span>{members.length} pessoa(s) com acesso à conta corporativa</span>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {members.map((m) => (
            <div key={m.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <strong>{m.name}</strong>
                <div className="form-hint">{m.email}</div>
              </div>
              <Badge tone="info">{ROLE_LABELS[m.role]}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
