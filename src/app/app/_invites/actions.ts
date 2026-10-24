"use server"

import { revalidatePath } from "next/cache"
import { and, eq, isNull, lt, ne, sql } from "drizzle-orm"
import { db } from "@/db"
import { invitations, memberships, users } from "@/db/schema"
import { createInvitation } from "@/lib/auth/invitations"
import { isInvitableRole } from "@/lib/auth/permissions"
import { requireSession } from "@/lib/auth/session"
import { normalizeEmail } from "@/lib/auth/tokens"

export type FormState = { error?: string; success?: string } | undefined

function revalidateInvitePages() {
  revalidatePath("/app/colaboradores")
  revalidatePath("/app/configuracoes")
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === "23505" || err?.cause?.code === "23505"
}

export async function inviteMember(_: FormState, formData: FormData): Promise<FormState> {
  // owner, admin e agent podem convidar; collaborator nunca chega aqui
  const session = await requireSession("corporate")

  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const role = String(formData.get("role") ?? "")
  const jobTitle = String(formData.get("jobTitle") ?? "").trim()

  if (!EMAIL_RE.test(email)) return { error: "Informe um e-mail válido." }
  if (!isInvitableRole(role)) return { error: "Escolha um papel válido." }
  // o cargo é definido pela empresa ao convidar um colaborador
  if (role === "collaborator" && jobTitle.length < 2) return { error: "Informe o cargo do colaborador." }
  if (jobTitle.length > 100) return { error: "Cargo muito longo (máximo 100 caracteres)." }

  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.companyId, session.company.id),
        eq(memberships.status, "active"),
        // a mesma pessoa pode ser colaboradora e também ter acesso corporativo: conta só o mesmo tipo
        role === "collaborator" ? eq(memberships.role, "collaborator") : ne(memberships.role, "collaborator"),
        sql`lower(${users.email}) = ${email}`,
      ),
    )
    .limit(1)
  if (member) return { error: role === "collaborator" ? "Essa pessoa já é colaboradora da empresa." : "Essa pessoa já tem acesso à empresa." }

  // convite vencido e não cancelado ainda ocupa o e-mail: encerra para liberar um novo
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.companyId, session.company.id),
        sql`lower(${invitations.email}) = ${email}`,
        eq(invitations.role, role),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        lt(invitations.expiresAt, new Date()),
      ),
    )

  let result: Awaited<ReturnType<typeof createInvitation>>
  try {
    result = await createInvitation({
      companyId: session.company.id,
      email,
      role,
      jobTitle: role === "collaborator" ? jobTitle : undefined,
      invitedByUserId: session.user.id,
    })
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Já existe um convite pendente para esse e-mail." }
    console.error("inviteMember", e)
    return { error: "Não foi possível enviar o convite. Tente novamente." }
  }

  revalidateInvitePages()
  return {
    success: result.emailSent
      ? `Convite enviado para ${email}.`
      : `Convite criado, mas o e-mail não foi enviado (provedor em modo de teste). Link para compartilhar: ${result.inviteUrl}`,
  }
}

export async function revokeInvitation(invitationId: string) {
  const session = await requireSession("corporate")
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.companyId, session.company.id),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
  revalidateInvitePages()
}

// Cancela o convite antigo (o link morre) e envia um novo
export async function resendInvitation(invitationId: string) {
  const session = await requireSession("corporate")
  const [old] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.companyId, session.company.id),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
      ),
    )
    .limit(1)
  if (!old || !isInvitableRole(old.role)) return

  await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, old.id))
  await createInvitation({
    companyId: old.companyId,
    email: old.email,
    name: old.name ?? undefined,
    role: old.role,
    jobTitle: old.jobTitle ?? undefined,
    invitedByUserId: session.user.id,
  })
  revalidateInvitePages()
}
