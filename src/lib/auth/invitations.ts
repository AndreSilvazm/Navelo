import "server-only"
import { eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { dbAdmin } from "@/db/admin"
import { companies, invitations, users, type MembershipRole } from "@/db/schema"
import { IS_PRODUCTION } from "@/lib/app-env"
import { sendInvitationEmail } from "@/lib/email"
import { senderAddress } from "@/lib/email/send"
import { getAppUrl } from "@/lib/env"
import { generateToken, hashToken, legacyHashToken, normalizeEmail } from "./tokens"

export type InvitationLookup =
  | { status: "invalid" | "expired" | "accepted" | "revoked" | "company_inactive" }
  | {
      status: "pending"
      invitation: { id: string; email: string; name: string | null; role: string; jobTitle: string | null }
      company: { legalName: string; tradeName: string | null }
      // já existe conta com esse e-mail → só pede a senha atual
      userExists: boolean
      // já aceitou os Termos de Uso e a Política de Privacidade
      termsAccepted: boolean
    }

export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  // quem abre o link ainda não tem sessão: consulta de sistema
  const [row] = await dbAdmin
    .select({ invitation: invitations, company: companies })
    .from(invitations)
    .innerJoin(companies, eq(companies.id, invitations.companyId))
    .where(inArray(invitations.tokenHash, [hashToken(token), legacyHashToken(token)]))
    .limit(1)

  if (!row) return { status: "invalid" }
  const { invitation, company } = row
  if (invitation.acceptedAt) return { status: "accepted" }
  if (invitation.revokedAt) return { status: "revoked" }
  if (invitation.expiresAt <= new Date()) return { status: "expired" }
  if (company.status !== "active") return { status: "company_inactive" }

  const [existing] = await dbAdmin
    .select({ id: users.id, termsAcceptedAt: users.termsAcceptedAt })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizeEmail(invitation.email)}`)
    .limit(1)

  return {
    status: "pending",
    invitation: { id: invitation.id, email: invitation.email, name: invitation.name, role: invitation.role, jobTitle: invitation.jobTitle },
    company: { legalName: company.legalName, tradeName: company.tradeName },
    userExists: !!existing,
    termsAccepted: !!existing?.termsAcceptedAt,
  }
}

export const INVITE_TTL_DAYS = 7

// Cria o convite e envia o e-mail. Se o envio falhar, o convite é revogado
// para não ficar um link válido que ninguém recebeu.
export async function createInvitation(input: {
  companyId: string
  email: string
  name?: string
  role: MembershipRole
  jobTitle?: string
  invitedByUserId: string
}) {
  const [company] = await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1)
  if (!company || company.status !== "active") throw new Error("Empresa inválida")

  const token = generateToken()
  const [invitation] = await db
    .insert(invitations)
    .values({
      companyId: input.companyId,
      email: normalizeEmail(input.email),
      name: input.name,
      role: input.role,
      jobTitle: input.jobTitle || null,
      tokenHash: hashToken(token),
      invitedByUserId: input.invitedByUserId,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning({ id: invitations.id })

  const inviteUrl = `${getAppUrl()}/convite/${token}`
  try {
    const emailSent = await sendInvitationEmail({
      to: normalizeEmail(input.email),
      name: input.name,
      companyName: company.tradeName ?? company.legalName,
      role: input.role,
      jobTitle: input.jobTitle,
      inviteUrl,
      expiresInDays: INVITE_TTL_DAYS,
    })
    // emailSent false sem exceção = não há RESEND_API_KEY neste ambiente (e ele não é produção)
    return { inviteUrl, emailSent, emailError: emailSent ? undefined : "RESEND_API_KEY não configurada neste ambiente", from: senderAddress() }
  } catch (e) {
    // Fora de produção (desenvolvimento e staging) o e-mail pode não estar configurado, ou o
    // provedor estar em modo de teste: o convite fica criado e o link é mostrado na tela para ser
    // passado na mão. Em produção, sem e-mail o convite não chega a ninguém: é desfeito.
    if (!IS_PRODUCTION) {
      const motivo = e instanceof Error ? e.message : String(e)
      console.warn("E-mail de convite não enviado:", motivo)
      return { inviteUrl, emailSent: false, emailError: motivo.replace(/^Falha ao enviar e-mail:s*/i, "").slice(0, 300), from: senderAddress() }
    }
    await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, invitation.id))
    throw e
  }
}
