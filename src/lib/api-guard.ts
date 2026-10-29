import "server-only"
import { getSession } from "@/lib/auth/session"
import { consumeRateLimit } from "@/lib/rate-limit"

/**
 * Porta de entrada das rotas de consulta externa: exige sessão e limita o uso por pessoa,
 * para a plataforma não virar um proxy aberto para a BrasilAPI.
 */
export async function guardLookup(limitPerMinute = 60) {
  const session = await getSession()
  if (!session) return Response.json({ error: "Não autorizado" }, { status: 401 })

  const { ok, retryAfterSeconds } = await consumeRateLimit(`lookup:${session.user.id}`, limitPerMinute, 60)
  if (!ok) {
    return Response.json({ found: false, reason: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } })
  }
  return null
}
