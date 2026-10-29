import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, invoices, memberships } from "@/db/schema"

/**
 * Ninguém decide sobre o próprio caso.
 *
 * A mesma pessoa pode ser agente (ou proprietária) e colaboradora da mesma empresa. Sem esta
 * trava, ela aprovaria o próprio cadastro, os próprios documentos e as próprias notas fiscais —
 * e ainda definiria quanto recebe. Quem analisa tem que ser outra pessoa do corporativo.
 */
export async function isOwnCollaboratorRecord(collaboratorId: string, userId: string) {
  const [row] = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .where(and(eq(collaborators.id, collaboratorId), eq(memberships.userId, userId)))
  return !!row
}

/** Mesma regra, a partir da nota fiscal */
export async function isOwnInvoice(invoiceId: string, userId: string) {
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .innerJoin(collaborators, eq(collaborators.id, invoices.collaboratorId))
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .where(and(eq(invoices.id, invoiceId), eq(memberships.userId, userId)))
  return !!row
}

export const SELF_REVIEW_ERROR =
  "Você não pode analisar o próprio cadastro nem as próprias notas. Peça a outra pessoa do corporativo."
