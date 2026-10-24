import type { Metadata } from "next"
import Link from "next/link"
import { Logo } from "@/figma/ui"
import { lookupInvitation } from "@/lib/auth/invitations"
import { AcceptForm } from "./accept-form"

export const metadata: Metadata = { title: "Convite", robots: { index: false } }

const messages = {
  invalid: "Este link de convite não é válido.",
  expired: "Este convite expirou. Peça um novo à sua empresa.",
  accepted: "Este convite já foi usado. Entre com seu e-mail e senha.",
  revoked: "Este convite foi cancelado pela empresa.",
  company_inactive: "A empresa deste convite está inativa.",
} as const

const roleLabel: Record<string, string> = {
  owner: "administrador",
  admin: "administrador",
  agent: "agente",
  collaborator: "colaborador",
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await lookupInvitation(token)

  return (
    <div className="login-page login-page-single lumen lumen-soft">
      <main className="login-main" id="conteudo">
        <div className="login-form">
          <Logo />
          {result.status === "pending" ? (
            <>
              <div className="login-heading">
                <h1>Você foi convidado</h1>
                <p>
                  <strong>{result.company.tradeName ?? result.company.legalName}</strong> convidou você{" "}
                  {result.invitation.jobTitle ? `para o cargo de ${result.invitation.jobTitle}` : `como ${roleLabel[result.invitation.role]}`}. Finalize seu acesso para continuar.
                </p>
              </div>
              <AcceptForm
                defaultName={result.invitation.name ?? ""}
                email={result.invitation.email}
                token={token}
                termsAccepted={result.termsAccepted}
                userExists={result.userExists}
              />
            </>
          ) : (
            <>
              <div className="login-heading">
                <h1>Convite indisponível</h1>
                <p>{messages[result.status]}</p>
              </div>
              <p className="signup-link">
                <Link href="/login">Ir para o login</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
