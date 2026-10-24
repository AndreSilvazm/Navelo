import type { Metadata } from "next"
import type { ReactNode } from "react"
import { AppShell } from "@/figma/app-shell"
import { listAccesses } from "@/lib/auth/accesses"
import { getPendingInvites } from "@/lib/portal-companies"
import { requireSession } from "@/lib/auth/session"

export const metadata: Metadata = { robots: { index: false, follow: false } }

const roleLabel = { owner: "Proprietário", admin: "Administrador", agent: "Agente" } as const

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireSession("corporate")
  // também é colaborador (ou tem outro acesso): mostra o atalho para trocar
  const [accesses, invites] = await Promise.all([listAccesses(session.user.id), getPendingInvites(session.user.email)])
  const hasOtherAccess = accesses.length > 1 || invites.length > 0

  return (
    <AppShell
      company={{ name: session.company.tradeName ?? session.company.legalName }}
      hasOtherAccess={hasOtherAccess}
      user={{
        name: session.user.name,
        roleLabel: roleLabel[session.role as keyof typeof roleLabel],
      }}
    >
      {children}
    </AppShell>
  )
}
