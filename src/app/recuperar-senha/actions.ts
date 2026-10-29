"use server"

import { and, eq, gt, isNull, lt, sql } from "drizzle-orm"
import { isIP } from "node:net"
import { headers } from "next/headers"
import { dbAdmin as db } from "@/db/admin"
import { passwordResets, sessions, users } from "@/db/schema"
import { hashPassword, validatePassword } from "@/lib/auth/password"
import { RESET_TTL_MINUTES } from "@/lib/auth/password-rules"
import { generateToken, hashToken, normalizeEmail } from "@/lib/auth/tokens"
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "@/lib/email"
import { APP_URL } from "@/lib/env"
import { audit } from "@/lib/audit"
import { clientIp, consumeRateLimit, minutesLabel } from "@/lib/rate-limit"

export type RequestState = { error?: string; sent?: boolean } | undefined
export type ResetState = { error?: string } | undefined

/** uma troca de senha a cada 15 minutos por conta */
const CHANGE_EVERY_MINUTES = 15

// Resposta sempre igual, com ou sem conta: senão o formulário vira um verificador de e-mails.
const SENT = { sent: true } as const

export async function requestPasswordReset(_: RequestState, formData: FormData): Promise<RequestState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email.includes("@")) return { error: "Informe um e-mail válido." }

  const ip = await clientIp()
  for (const [key, limit, window] of [
    [`senha:pedido:ip:${ip}`, 10, 60 * 60],
    [`senha:pedido:email:${email}`, 3, 60 * 60],
  ] as const) {
    const { ok } = await consumeRateLimit(key, limit, window)
    if (!ok) return SENT // não conta para quem está tentando descobrir e-mails
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, status: users.status })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1)
  if (!user || user.status !== "active") return SENT

  const token = generateToken()
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()

  await db.transaction(async (tx) => {
    // um pedido novo derruba os anteriores que ainda estavam de pé
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)))
    await tx.insert(passwordResets).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      requestedIp: forwarded && isIP(forwarded) ? forwarded : null,
    })
  })

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: `${APP_URL}/recuperar-senha/${token}`,
      expiresInMinutes: RESET_TTL_MINUTES,
    })
  } catch (error) {
    // Em desenvolvimento o Resend só entrega ao dono da conta: o link fica no terminal.
    if (process.env.NODE_ENV !== "production") {
      console.warn("E-mail de troca de senha não enviado:", error instanceof Error ? error.message : error)
      console.warn(`Link para trocar a senha: ${APP_URL}/recuperar-senha/${token}`)
      return SENT
    }
    throw error
  }
  return SENT
}

/** O token do link ainda vale? */
export async function findValidReset(token: string) {
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, name: users.name, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
        eq(users.status, "active"),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function resetPassword(token: string, _: ResetState, formData: FormData): Promise<ResetState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  const ip = await clientIp()
  const { ok: ipOk } = await consumeRateLimit(`senha:troca:ip:${ip}`, 10, 60 * 60)
  if (!ipOk) return { error: "Muitas tentativas. Tente de novo mais tarde." }

  const reset = await findValidReset(token)
  if (!reset) return { error: "Este link não vale mais. Peça um novo." }

  if (password !== confirm) return { error: "As senhas não conferem." }
  const weak = await validatePassword(password, { email: reset.email, name: reset.name })
  if (weak) return { error: weak }

  // uma troca a cada 15 minutos por conta
  const { ok, retryAfterSeconds } = await consumeRateLimit(`senha:troca:user:${reset.userId}`, 1, CHANGE_EVERY_MINUTES * 60)
  if (!ok) return { error: `A senha desta conta foi trocada há pouco. Tente de novo em ${minutesLabel(retryAfterSeconds)}.` }

  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId))
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id))
    // trocou a senha, cai de todos os aparelhos: quem tiver roubado a sessão perde o acesso
    await tx.delete(sessions).where(eq(sessions.userId, reset.userId))
    // limpeza dos pedidos velhos desta conta
    await tx.delete(passwordResets).where(and(eq(passwordResets.userId, reset.userId), lt(passwordResets.expiresAt, new Date())))
  })

  await sendPasswordChangedEmail({
    to: reset.email,
    name: reset.name,
    quando: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
  })

  await audit({
    action: "password.changed",
    actor: { id: reset.userId, name: reset.name, role: "self" },
    targetType: "user",
    targetId: reset.userId,
    targetLabel: reset.email,
    details: { via: "link por e-mail", sessoesEncerradas: true },
  })

  // o login volta a ser liberado depois de trocar a senha
  await db.execute(sql`delete from rate_limits where key = ${`login:email:${normalizeEmail(reset.email)}`}`)
  return {}
}
