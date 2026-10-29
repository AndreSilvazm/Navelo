"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Button, Checkbox, TextField } from "@/figma/ui"
import { login } from "./actions"

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="login-fields" style={{ display: "grid", gap: 20 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      <TextField
        autoComplete="email"
        icon="mail"
        label="E-mail"
        name="email"
        placeholder="voce@empresa.com.br"
        required
        type="email"
      />
      <TextField
        autoComplete="current-password"
        icon="lock"
        label="Senha"
        name="password"
        placeholder="Sua senha"
        required
        type="password"
      />
      <div className="form-options">
        <Checkbox label="Lembrar de mim" name="remember" />
        <Link href="/recuperar-senha">
          Esqueci minha senha
        </Link>
      </div>
      <Button className="full-button button-lg" loading={pending} disabled={pending} type="submit">
        Entrar
      </Button>
      <p className="signup-link">
        O acesso é feito por convite da sua empresa. Procure o administrador da conta.
      </p>
      <p className="legal-note">
        Ao entrar, você concorda com os <Link href="/termos">Termos de Uso</Link> e a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    </form>
  )
}
