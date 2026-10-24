import "server-only"
import { cache } from "react"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { isIP } from "node:net"
import { and, eq, gt } from "drizzle-orm"
import { db } from "@/db"
import { companies, memberships, sessions, users, type MembershipRole } from "@/db/schema"
import { generateToken, hashToken } from "./tokens"

export const SESSION_COOKIE = "navelo_session"

const DAY = 24 * 60 * 60

export const SESSION_TTL = { default: 7 * DAY, remember: 30 * DAY }

export const CORPORATE_ROLES = ["owner", "admin", "agent"] as const satisfies MembershipRole[]

export function isCorporateRole(role: MembershipRole) {
  return (CORPORATE_ROLES as readonly string[]).includes(role)
}

// Onde cada papel começa depois de entrar
export function homeFor(role: MembershipRole) {
  return isCorporateRole(role) ? "/app" : "/portal"
}

// Um acesso é um vínculo da pessoa com uma empresa (colaborador ou corporativo).
export type Access = { membershipId: string; companyId: string }

export async function createSession(userId: string, access: Access, ttlSeconds = SESSION_TTL.default) {
  const token = generateToken()
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim()

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    membershipId: access.membershipId,
    companyId: access.companyId,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    ipAddress: ip && isIP(ip) ? ip : null,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  })
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    sessionCache.delete(hashToken(token))
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
  }
  store.delete(SESSION_COOKIE)
}

// Troca o acesso em uso na sessão atual (empresa e papel). Quem chama já conferiu que o vínculo
// é do usuário e está ativo.
export async function setSessionAccess(access: Access) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return
  const key = hashToken(token)
  await db.update(sessions).set({ membershipId: access.membershipId, companyId: access.companyId }).where(eq(sessions.id, key))
  sessionCache.delete(key)
}

// Cache curto em memória: validar a sessão custa uma ida ao banco (~120 ms) em TODA
// requisição. Por até 20 s reaproveita o resultado; logout limpa na hora. Efeito colateral:
// desativar um usuário ou tirar o vínculo pode levar até 20 s para valer.
const SESSION_CACHE_TTL_MS = 20_000
const SESSION_CACHE_MAX = 500
const sessionCache = new Map<string, { value: NonNullable<Awaited<ReturnType<typeof loadSession>>>; expires: number }>()

async function loadSession(sessionId: string) {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      membershipId: memberships.id,
      user: { id: users.id, name: users.name, email: users.email },
      company: { id: companies.id, legalName: companies.legalName, tradeName: companies.tradeName, cnpj: companies.cnpj },
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(memberships, and(eq(memberships.id, sessions.membershipId), eq(memberships.userId, sessions.userId)))
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "active"),
        eq(companies.status, "active"),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1)
  return row ?? null
}

// Valida o cookie contra o banco. Toda checagem de acesso passa por aqui —
// o proxy só faz um filtro otimista (existe cookie ou não).
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const key = hashToken(token)
  const hit = sessionCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  const row = await loadSession(key)
  if (!row) {
    sessionCache.delete(key)
    return null
  }
  if (sessionCache.size >= SESSION_CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value!)
  sessionCache.set(key, { value: row, expires: Date.now() + SESSION_CACHE_TTL_MS })
  return row
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>

// Para layouts/páginas/actions protegidas. Quem está logado mas no portal errado
// é mandado para o seu próprio.
export async function requireSession(area?: "corporate" | "collaborator") {
  const session = await getSession()
  if (!session) redirect("/login")

  if (area === "corporate" && !isCorporateRole(session.role)) redirect(homeFor(session.role))
  if (area === "collaborator" && session.role !== "collaborator") redirect(homeFor(session.role))

  return session
}
