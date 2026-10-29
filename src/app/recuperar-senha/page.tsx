import type { Metadata } from "next"
import { Logo } from "@/figma/ui"
import { RequestForm } from "./request-form"

export const metadata: Metadata = { title: "Trocar senha", robots: { index: false, follow: false } }

// A CSP leva um nonce novo a cada requisição (ver src/proxy.ts), então a página é sob demanda.
export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <div className="login-page login-page-single lumen lumen-soft">
      <main className="login-main" id="conteudo">
        <div className="login-form">
          <Logo />
          <div className="login-heading">
            <h1>Trocar senha</h1>
            <p>Informe o e-mail da sua conta. Enviamos um link para você criar uma nova senha.</p>
          </div>
          <RequestForm />
        </div>
      </main>
    </div>
  )
}
