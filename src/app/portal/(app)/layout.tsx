import type { Metadata } from "next"
import type { ReactNode } from "react"
import { PortalShell } from "@/figma/portal-shell"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { getPortalCompanies } from "@/lib/portal-companies"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Todo o portal do colaborador. Só entra quem já foi liberado pela empresa ativa; os demais são
// levados para /portal/primeiro-acesso (onde dá para trocar de empresa).
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { session } = await requireActiveCollaborator()
  const switcher = await getPortalCompanies(session)

  return (
    <PortalShell
      company={{ name: session.company.tradeName ?? session.company.legalName }}
      switcher={switcher}
      user={{ name: session.user.name }}
    >
      {children}
    </PortalShell>
  )
}
