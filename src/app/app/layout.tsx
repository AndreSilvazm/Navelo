import type { Metadata } from "next"
import type { ReactNode } from "react"
import { AppShell } from "@/figma/app-shell"
import { listAccesses } from "@/lib/auth/accesses"
import { getPendingInvites } from "@/lib/portal-companies"
import { requireSession } from "@/lib/auth/session"
import { ttlCached } from "@/lib/ttl-cache"

export const metadata: Metadata = { robots: { index: false, follow: false } }

const roleLabel = { owner: "Proprietário", admin: "Administrador", agent: "Agente" } as const

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireSession("corporate")
  // também é colaborador (ou tem outro acesso): mostra o atalho para trocar
  // (em cache por 30 s: o menu não muda a cada clique; ações que alteram dados limpam o cache)
  const [accesses, invites] = await ttlCached(`layout:${session.user.id}`, 30_000, () =>
    Promise.all([listAccesses(session.user.id), getPendingInvites(session.user.email)]),
  )
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
