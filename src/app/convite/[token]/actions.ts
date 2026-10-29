"use server"

import { redirect } from "next/navigation"
import { and, eq, inArray, sql } from "drizzle-orm"
import { dbAdmin as db } from "@/db/admin"
import { companies, invitations, memberships, users } from "@/db/schema"
import { LEGAL_VERSION } from "@/lib/legal"
import { joinAsCollaborator } from "@/lib/collaborator-join"
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password"
import { createSession, homeFor } from "@/lib/auth/session"
import { hashToken, legacyHashToken, normalizeEmail } from "@/lib/auth/tokens"
import { clientIp, consumeRateLimit, minutesLabel } from "@/lib/rate-limit"
import { FULL_NAME_ERROR, isFullName } from "@/lib/auth/validation"

export type FormState = { error?: string } | undefined

class InviteError extends Error {}

export async function acceptInvitation(
  token: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ")

  const ip = await clientIp()
  for (const [key, limit, window] of [
    [`convite:ip:${ip}`, 20, 15 * 60],
    [`convite:token:${hashToken(token)}`, 8, 15 * 60],
  ] as const) {
    const { ok, retryAfterSeconds } = await consumeRateLimit(key, limit, window)
    if (!ok) return { error: `Muitas tentativas. Tente de novo em ${minutesLabel(retryAfterSeconds)}.` }
  }

  let result: { userId: string; membershipId: string; companyId: string; role: Parameters<typeof homeFor>[0] }

  try {
    result = await db.transaction(async (tx) => {
      // trava o convite: dois cliques/abas não aceitam duas vezes
      const [row] = await tx
        .select({ invitation: invitations, companyStatus: companies.status })
        .from(invitations)
        .innerJoin(companies, eq(companies.id, invitations.companyId))
        // o formato antigo (sha256) ainda vale para convites criados antes do AUTH_SECRET
        .where(inArray(invitations.tokenHash, [hashToken(token), legacyHashToken(token)]))
        .for("update", { of: invitations })
        .limit(1)

      if (!row) throw new InviteError("Convite inválido.")
      const { invitation } = row
      if (invitation.acceptedAt) throw new InviteError("Este convite já foi usado.")
      if (invitation.revokedAt) throw new InviteError("Este convite foi cancelado.")
      if (invitation.expiresAt <= new Date()) throw new InviteError("Este convite expirou. Peça um novo à sua empresa.")
      if (row.companyStatus !== "active") throw new InviteError("A empresa deste convite está inativa.")

      const email = normalizeEmail(invitation.email)
      const [existing] = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1)

      // aceite dos Termos e da Política: obrigatório para quem ainda não aceitou, e fica registrado
      const needsTerms = !existing?.termsAcceptedAt
      if (needsTerms && formData.get("terms") !== "on") throw new InviteError("Aceite os Termos de Uso e a Política de Privacidade para continuar.")
      const terms = { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION }

      let userId: string
      if (existing) {
        // quem já tem conta prova que é a pessoa com a senha atual
        if (!(await verifyPassword(existing.passwordHash, password))) throw new InviteError("Senha incorreta.")
        if (existing.status !== "active") throw new InviteError("Esta conta está desativada.")
        userId = existing.id
        if (needsTerms) await tx.update(users).set(terms).where(eq(users.id, existing.id))
      } else {
        if (!isFullName(name)) throw new InviteError(FULL_NAME_ERROR)
        if (password !== confirm) throw new InviteError("As senhas não conferem.")
        const weak = await validatePassword(password, { email, name })
        if (weak) throw new InviteError(weak)

        const [created] = await tx
          .insert(users)
          .values({ email, name, passwordHash: await hashPassword(password), ...terms })
          .returning({ id: users.id })
        userId = created.id
      }

      let membershipId: string
      if (invitation.role === "collaborator") {
        // colaborador PJ: quem já tem cadastro em outra empresa leva os dados e vai direto aos documentos
        membershipId = (await joinAsCollaborator(tx, { userId, companyId: invitation.companyId, jobTitle: invitation.jobTitle })).membershipId
      } else {
        // vínculo corporativo pode já existir (ex.: pessoa removida e convidada de novo);
        // o vínculo de colaborador da mesma empresa é outro e não é tocado
        const [m] = await tx
          .insert(memberships)
          .values({ companyId: invitation.companyId, userId, role: invitation.role })
          .onConflictDoUpdate({
            target: [memberships.companyId, memberships.userId],
            targetWhere: sql`${memberships.role} <> 'collaborator'`,
            set: { role: invitation.role, status: "active" },
          })
          .returning({ id: memberships.id })
        membershipId = m.id
      }

      await tx
        .update(invitations)
        .set({ acceptedAt: new Date(), acceptedByUserId: userId })
        .where(and(eq(invitations.id, invitation.id)))

      return { userId, membershipId, companyId: invitation.companyId, role: invitation.role }
    })
  } catch (e) {
    if (e instanceof InviteError) return { error: e.message }
    throw e
  }

  await createSession(result.userId, { membershipId: result.membershipId, companyId: result.companyId })
  redirect(homeFor(result.role))
}
