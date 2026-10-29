import type { Metadata } from "next"
import { Button, Logo } from "@/figma/ui"
import { findValidReset } from "../actions"
import { ResetForm } from "./reset-form"

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false } }

export const dynamic = "force-dynamic"

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const reset = await findValidReset(token)

  return (
    <div className="login-page login-page-single lumen lumen-soft">
      <main className="login-main" id="conteudo">
        <div className="login-form">
          <Logo />
          {reset ? (
            <>
              <div className="login-heading">
                <h1>Criar nova senha</h1>
                <p>
                  Conta: <strong>{reset.email}</strong>
                </p>
              </div>
              <ResetForm token={token} />
            </>
          ) : (
            <>
              <div className="login-heading">
                <h1>Link inválido</h1>
                <p>Este link já foi usado ou expirou. Peça um novo para trocar a senha.</p>
              </div>
              <Button className="full-button button-lg" href="/recuperar-senha">
                Pedir novo link
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
