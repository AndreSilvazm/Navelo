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
