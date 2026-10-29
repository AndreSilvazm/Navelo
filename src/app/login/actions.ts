"use server"

import { redirect } from "next/navigation"
import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { getPendingInvites } from "@/lib/portal-companies"
import { listAccesses, needsChoice } from "@/lib/auth/accesses"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { SESSION_TTL, createSession, destroySession, homeFor } from "@/lib/auth/session"
import { normalizeEmail } from "@/lib/auth/tokens"
import { clientIp, consumeRateLimit, minutesLabel, resetRateLimit } from "@/lib/rate-limit"

export type FormState = { error?: string } | undefined

const INVALID = "E-mail ou senha incorretos."

// Hash descartável: quando o e-mail não existe, gasta o mesmo tempo de uma
// verificação real para não revelar quais e-mails têm conta.
let dummyHash: Promise<string> | undefined

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const password = String(formData.get("password") ?? "")
  const remember = formData.get("remember") === "on"

  if (!email || !password) return { error: "Informe e-mail e senha." }

  // Freio de força bruta: por IP (ataque amplo) e por e-mail (ataque a uma conta). A contagem
  // acontece antes de olhar o banco, então a resposta não revela se o e-mail existe.
  const ip = await clientIp()
  const emailKey = `login:email:${email}`
  for (const [key, limit, window] of [
    [`login:ip:${ip}`, 30, 10 * 60],
    [emailKey, 5, 15 * 60],
  ] as const) {
    const { ok, retryAfterSeconds } = await consumeRateLimit(key, limit, window)
    if (!ok) return { error: `Muitas tentativas de acesso. Tente de novo em ${minutesLabel(retryAfterSeconds)}.` }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1)

  if (!user) {
    dummyHash ??= hashPassword("navelo-dummy-password")
    await verifyPassword(await dummyHash, password)
    return { error: INVALID }
  }

  if (!(await verifyPassword(user.passwordHash, password))) return { error: INVALID }
  if (user.status !== "active") return { error: "Esta conta está desativada." }

  // Acesso inicial da sessão: o vínculo mais antigo ainda ativo.
  const [accesses, invites] = await Promise.all([listAccesses(user.id), getPendingInvites(user.email)])
  const first = accesses[0]
  if (!first) return { error: "Sua conta não tem acesso a nenhuma empresa ativa." }

  await resetRateLimit(emailKey) // entrou: zera o contador da conta
  await createSession(user.id, first, remember ? SESSION_TTL.remember : SESSION_TTL.default)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

  // agente/proprietário que também é colaborador (ou com mais de um acesso corporativo): escolhe como entrar
  if (needsChoice(accesses, invites.length)) redirect("/acesso")
  redirect(homeFor(first.role))
}

export async function logout() {
  await destroySession()
  redirect("/login")
}
