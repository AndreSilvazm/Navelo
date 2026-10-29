import "server-only"
import { getSession } from "@/lib/auth/session"

export type DbContext = { userId: string; companyId: string; role: string; membershipId: string }

/**
 * Quem está agindo nesta requisição, no formato que as políticas de RLS esperam. Sai da sessão
 * (cookie), nunca de dado enviado pelo navegador. Sem sessão devolve null, e sem contexto o
 * banco não entrega nenhuma linha.
 */
export async function resolveDbContext(): Promise<DbContext | null> {
  try {
    const session = await getSession()
    if (!session) return null
    return { userId: session.user.id, companyId: session.company.id, role: session.role, membershipId: session.membershipId }
  } catch {
    // fora de uma requisição (script, build): sem contexto
    return null
  }
}
