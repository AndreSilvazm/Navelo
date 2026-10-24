import "server-only"
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, companies, invitations, memberships, type CollaboratorStatus } from "@/db/schema"
import { listAccesses, roleLabel } from "@/lib/auth/accesses"
import type { AuthSession } from "@/lib/auth/session"

export type PortalCompany = { id: string; name: string; status: CollaboratorStatus; current: boolean }
export type PortalInvite = { id: string; companyName: string; jobTitle: string | null }
// outro acesso da pessoa (ex.: agente da mesma empresa), para entrar por ele
export type PortalOtherAccess = { membershipId: string; label: string }

// Convites de colaborador pendentes enviados para o e-mail da conta (vale para qualquer acesso dela)
export async function getPendingInvites(email: string): Promise<PortalInvite[]> {
  const rows = await db
    .select({ id: invitations.id, legalName: companies.legalName, tradeName: companies.tradeName, jobTitle: invitations.jobTitle })
    .from(invitations)
    .innerJoin(companies, eq(companies.id, invitations.companyId))
    .where(
      and(
        sql`lower(${invitations.email}) = ${email.toLowerCase()}`,
        eq(invitations.role, "collaborator"),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
        eq(companies.status, "active"),
      ),
    )
    .orderBy(asc(invitations.createdAt))
  return rows.map((i) => ({ id: i.id, companyName: i.tradeName ?? i.legalName, jobTitle: i.jobTitle }))
}

// Empresas em que a pessoa é colaboradora, convites pendentes e acessos corporativos dela:
// alimentam o seletor de empresa.
export async function getPortalCompanies(
  session: AuthSession,
): Promise<{ companies: PortalCompany[]; invites: PortalInvite[]; others: PortalOtherAccess[] }> {
  const [mine, pending, accesses] = await Promise.all([
    db
      .select({
        id: companies.id,
        legalName: companies.legalName,
        tradeName: companies.tradeName,
        status: collaborators.status,
      })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .leftJoin(collaborators, eq(collaborators.membershipId, memberships.id))
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.role, "collaborator"),
          eq(memberships.status, "active"),
          eq(companies.status, "active"),
        ),
      )
      .orderBy(asc(memberships.createdAt)),
    getPendingInvites(session.user.email),
    listAccesses(session.user.id),
  ])

  return {
    companies: mine.map((c) => ({ id: c.id, name: c.tradeName ?? c.legalName, status: c.status ?? "profile_pending", current: c.id === session.company.id })),
    invites: pending,
    others: accesses.filter((a) => a.area === "corporate").map((a) => ({ membershipId: a.membershipId, label: `${roleLabel[a.role]} · ${a.companyName}` })),
  }
}

export type PortalSwitcherData = Awaited<ReturnType<typeof getPortalCompanies>>
