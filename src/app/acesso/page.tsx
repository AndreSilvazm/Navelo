import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { logout } from "@/app/login/actions"
import { Button, Logo } from "@/figma/ui"
import { listAccesses, roleLabel } from "@/lib/auth/accesses"
import { getSession, homeFor } from "@/lib/auth/session"
import { initialsOf } from "@/lib/initials"
import { acceptPendingInvitation } from "@/app/portal/actions"
import { getPendingInvites } from "@/lib/portal-companies"
import { chooseAccess } from "./actions"

export const metadata: Metadata = { title: "Escolher acesso", robots: { index: false } }

// Depois do login, para quem tem mais de um acesso: entrar como colaborador ou como agente/proprietário.
export default async function ChooseAccessPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [accesses, invites] = await Promise.all([listAccesses(session.user.id), getPendingInvites(session.user.email)])
  if (accesses.length === 1 && invites.length === 0) redirect(homeFor(accesses[0].role))

  return (
    <div className="login-page login-page-single lumen lumen-soft">
      <main className="login-main" id="conteudo">
        <div className="login-form">
          <Logo />
          <div className="login-heading">
            <h1>Como você quer entrar?</h1>
            <p>Olá, {session.user.name.split(" ")[0]}. Você tem mais de um acesso. Dá para trocar depois, sem sair da conta.</p>
          </div>
          <ul className="access-list">
            {accesses.map((a) => (
              <li key={a.membershipId}>
                <form action={chooseAccess.bind(null, a.membershipId)}>
                  <button className={a.membershipId === session.membershipId ? "current" : ""} type="submit">
                    <span className="company-dot">{initialsOf(a.companyName)}</span>
                    <span>
                      <strong>Entrar como {a.area === "collaborator" ? "colaborador" : roleLabel[a.role]}</strong>
                      <small>{a.companyName}</small>
                    </span>
                    <i aria-hidden="true">→</i>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {invites.length > 0 && (
            <>
              <p className="switcher-title">Convites para ser colaborador</p>
              <ul className="access-list">
                {invites.map((i) => (
                  <li key={i.id}>
                    <form action={acceptPendingInvitation.bind(null, i.id)}>
                      <button type="submit">
                        <span className="company-dot">{initialsOf(i.companyName)}</span>
                        <span>
                          <strong>Aceitar convite · {i.companyName}</strong>
                          <small>{i.jobTitle ? `Cargo: ${i.jobTitle}. ` : ""}Você preenche seus dados e documentos.</small>
                        </span>
                        <i aria-hidden="true">→</i>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
