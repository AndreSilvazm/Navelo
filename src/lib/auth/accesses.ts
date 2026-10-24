import "server-only"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { companies, memberships, type MembershipRole } from "@/db/schema"
import { isCorporateRole } from "./session"

export type UserAccess = {
  membershipId: string
  companyId: string
  companyName: string
  role: MembershipRole
  area: "corporate" | "collaborator"
}

export const roleLabel: Record<MembershipRole, string> = {
  owner: "proprietário",
  admin: "administrador",
  agent: "agente",
  collaborator: "colaborador",
}

// Tudo em que a pessoa pode entrar: um acesso por vínculo ativo (empresa + papel).
// A mesma pessoa pode ser, por exemplo, agente e colaborador da mesma empresa.
export async function listAccesses(userId: string): Promise<UserAccess[]> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      companyId: companies.id,
      legalName: companies.legalName,
      tradeName: companies.tradeName,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(companies.status, "active")))
    .orderBy(asc(memberships.createdAt))

  return rows.map((r) => ({
    membershipId: r.membershipId,
    companyId: r.companyId,
    companyName: r.tradeName ?? r.legalName,
    role: r.role,
    area: isCorporateRole(r.role) ? "corporate" : "collaborator",
  }))
}

// Precisa escolher como entrar? Quando há acesso corporativo junto com outro (de colaborador ou
// de outra empresa). Quem só é colaborador (mesmo em várias empresas) usa o seletor do portal.
export function needsChoice(accesses: UserAccess[], pendingInvites = 0) {
  if (pendingInvites > 0 && accesses.some((a) => a.area === "corporate")) return true
  const corporate = accesses.filter((a) => a.area === "corporate").length
  return corporate > 0 && accesses.length > 1
}
