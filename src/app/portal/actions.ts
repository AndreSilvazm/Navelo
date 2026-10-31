"use server"

import { revalidatePath } from "@/lib/revalidate"
import { redirect } from "next/navigation"
import { and, eq, gt, isNull, sql } from "drizzle-orm"
import { dbAdmin as db } from "@/db/admin"
import { companies, invitations, memberships } from "@/db/schema"
import { getSession, requireSession, setSessionAccess } from "@/lib/auth/session"
import { joinAsCollaborator } from "@/lib/collaborator-join"

// Troca a visão do colaborador para outra empresa dele
export async function switchCompany(companyId: string) {
  const session = await requireSession("collaborator")

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(
        eq(memberships.userId, session.user.id),
        eq(memberships.companyId, companyId),
        eq(memberships.role, "collaborator"),
        eq(memberships.status, "active"),
        eq(companies.status, "active"),
      ),
    )
    .limit(1)
  if (!membership) return

  await setSessionAccess({ membershipId: membership.id, companyId })
  // a empresa ativa muda o topo e todas as páginas: derruba o cache de navegação do portal
  revalidatePath("/portal", "layout")
  redirect("/portal")
}

// Aceita, já logado, um convite enviado para o e-mail da própria conta. A empresa passa a ver a
// pessoa "em cadastro" e ela completa só o que aquela empresa pede (documentos).
export async function acceptPendingInvitation(invitationId: string) {
  const session = await getSession()
  if (!session) redirect("/login")

  const joined = await db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(invitations)
      .innerJoin(companies, eq(companies.id, invitations.companyId))
      .where(
        and(
          eq(invitations.id, invitationId),
          // só convites enviados para o e-mail desta conta
          sql`lower(${invitations.email}) = ${session.user.email.toLowerCase()}`,
          eq(invitations.role, "collaborator"),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
          eq(companies.status, "active"),
        ),
      )
      .for("update", { of: invitations })
      .limit(1)
    if (!invitation) return null

    const { membershipId } = await joinAsCollaborator(tx, { userId: session.user.id, companyId: invitation.invitations.companyId, jobTitle: invitation.invitations.jobTitle })
    await tx.update(invitations).set({ acceptedAt: new Date(), acceptedByUserId: session.user.id }).where(eq(invitations.id, invitationId))
    return { membershipId, companyId: invitation.invitations.companyId }
  })
  if (!joined) return

  await setSessionAccess(joined)
  revalidatePath("/portal", "layout")
  redirect("/portal") // sem cadastro completo nessa empresa, o portal leva à tela de etapas
}
