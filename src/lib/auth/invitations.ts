import "server-only"
import { eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { companies, invitations, users, type MembershipRole } from "@/db/schema"
import { sendInvitationEmail } from "@/lib/email"
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
  const [row] = await db
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

  const [existing] = await db
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

  const inviteUrl = `${process.env.APP_URL}/convite/${token}`
  try {
    await sendInvitationEmail({
      to: normalizeEmail(input.email),
      name: input.name,
      companyName: company.tradeName ?? company.legalName,
      role: input.role,
      jobTitle: input.jobTitle,
      inviteUrl,
      expiresInDays: INVITE_TTL_DAYS,
    })
  } catch (e) {
    // Em desenvolvimento o Resend fica em modo de teste (só entrega ao dono da conta):
    // mantém o convite e devolve o link para ser compartilhado na mão.
    if (process.env.NODE_ENV !== "production") {
      console.warn("E-mail de convite não enviado:", e instanceof Error ? e.message : e)
      return { inviteUrl, emailSent: false }
    }
    await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, invitation.id))
    throw e
  }
  return { inviteUrl, emailSent: true }
}
