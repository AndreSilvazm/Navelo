import type { MembershipRole } from "@/db/schema"

// Papéis que podem ser concedidos por convite. "owner" só nasce no cadastro da
// empresa (npm run company:create) — ninguém convida outro owner.
export const INVITABLE_ROLES = ["admin", "agent", "collaborator"] as const satisfies MembershipRole[]
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  agent: "Agente",
  collaborator: "Colaborador PJ",
}

export function isInvitableRole(role: string): role is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role)
}
