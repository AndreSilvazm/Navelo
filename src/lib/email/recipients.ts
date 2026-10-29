import "server-only"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, companies, memberships, users } from "@/db/schema"

/** Para quem mandar o aviso de um colaborador: a pessoa e o nome da empresa dele */
export async function collaboratorContact(collaboratorId: string) {
  const [row] = await db
    .select({
      email: users.email,
      name: users.name,
      companyName: companies.tradeName,
      legalName: companies.legalName,
    })
    .from(collaborators)
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(companies, eq(companies.id, collaborators.companyId))
    .where(eq(collaborators.id, collaboratorId))
  if (!row) return null
  // "to" já no formato que as funções de envio esperam
  return { to: row.email, name: row.name, companyName: row.companyName ?? row.legalName }
}

/**
 * Quem decide na empresa. Avisos sensíveis (troca de conta bancária) vão só para proprietário e
 * administradores: agente demais na cópia vira ruído, e ruído faz a pessoa parar de ler.
 */
export async function corporateContacts(companyId: string) {
  return db
    .select({ email: users.email, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.companyId, companyId),
        eq(memberships.status, "active"),
        eq(users.status, "active"),
        inArray(memberships.role, ["owner", "admin"]),
      ),
    )
}
