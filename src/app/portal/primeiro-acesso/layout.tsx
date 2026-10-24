import type { Metadata } from "next"
import type { ReactNode } from "react"
import { logout } from "@/app/login/actions"
import { CompanySwitcher } from "@/components/company-switcher"
import { getPortalCompanies } from "@/lib/portal-companies"
import { Button, Logo } from "@/figma/ui"
import { requireOnboardingCollaborator } from "@/lib/collaborators"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Tela cheia, sem menu: no primeiro acesso o colaborador não vê nada além do cadastro.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const { session } = await requireOnboardingCollaborator()
  const switcher = await getPortalCompanies(session)
  // quem já é colaborador em outra empresa não está no primeiro acesso: pode sair daqui e voltar depois
  const hasOther = switcher.companies.length > 1 || switcher.invites.length > 0 || switcher.others.length > 0

  return (
    <div className="onboarding-page lumen lumen-soft">
      <header className="onboarding-header">
        <Logo />
        {hasOther && <CompanySwitcher {...switcher} />}
        <div className="onboarding-user">
          <span>{session.user.name}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="onboarding-main" id="conteudo">
        {children}
      </main>
    </div>
  )
}
