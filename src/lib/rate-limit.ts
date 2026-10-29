import "server-only"
import { headers } from "next/headers"
import { sql } from "drizzle-orm"
import { dbAdmin as db } from "@/db/admin"

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number }

// Contador por janela, guardado no banco (vale para vários processos, ao contrário da memória).
// Cada chamada soma 1 na chave; passou do limite dentro da janela, bloqueia até ela expirar.
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const rows = await db.execute<{ count: number; expires_at: Date }>(sql`
      insert into rate_limits (key, count, expires_at)
      values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
      on conflict (key) do update set
        count = case when rate_limits.expires_at <= now() then 1 else rate_limits.count + 1 end,
        expires_at = case when rate_limits.expires_at <= now() then now() + make_interval(secs => ${windowSeconds}) else rate_limits.expires_at end
      returning count, expires_at
    `)
    const row = rows[0]
    if (!row) return { ok: true, retryAfterSeconds: 0 }

    // limpeza preguiçosa: de vez em quando varre o que já expirou
    if (Math.random() < 0.01) await db.execute(sql`delete from rate_limits where expires_at <= now()`)

    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 1000))
    return { ok: Number(row.count) <= limit, retryAfterSeconds }
  } catch (error) {
    // Falha do contador não pode derrubar o login. Registra e deixa passar.
    console.error("rate-limit", error)
    return { ok: true, retryAfterSeconds: 0 }
  }
}

/** Zera a chave (ex.: depois de um login bem-sucedido) */
export async function resetRateLimit(key: string) {
  try {
    await db.execute(sql`delete from rate_limits where key = ${key}`)
  } catch (error) {
    console.error("rate-limit reset", error)
  }
}

// IP de quem chamou. Atrás de proxy/CDN, vale o primeiro da cadeia do x-forwarded-for — só confie
// nisso quando o proxy for seu e sobrescrever o cabeçalho (senão dá para forjar).
export async function clientIp() {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || h.get("x-real-ip") || "desconhecido"
}

export function minutesLabel(seconds: number) {
  const minutes = Math.ceil(seconds / 60)
  return minutes <= 1 ? "um minuto" : `${minutes} minutos`
}
