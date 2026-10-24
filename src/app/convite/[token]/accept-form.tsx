"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button, TextField } from "@/figma/ui"
import { acceptInvitation } from "./actions"

export function AcceptForm({
  token,
  email,
  defaultName,
  userExists,
  termsAccepted,
}: {
  token: string
  email: string
  defaultName: string
  userExists: boolean
  termsAccepted: boolean
}) {
  const [state, action, pending] = useActionState(acceptInvitation.bind(null, token), undefined)

  return (
    <form action={action} style={{ display: "grid", gap: 20 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      <TextField icon="mail" label="E-mail" readOnly defaultValue={email} />
      {userExists ? (
        <>
          <p className="form-hint">
            Você já tem uma conta no Navelo. Confirme sua senha para entrar nesta empresa.
          </p>
          <TextField
            autoComplete="current-password"
            icon="lock"
            label="Senha"
            name="password"
            required
            type="password"
          />
        </>
      ) : (
        <>
          <TextField
            autoComplete="name"
            defaultValue={defaultName}
            hint="Nome e sobrenome, como no seu documento."
            label="Nome completo"
            name="name"
            placeholder="Ex.: Maria da Silva"
            required
          />
          <TextField
            autoComplete="new-password"
            icon="lock"
            label="Crie uma senha"
            name="password"
            placeholder="Mínimo de 8 caracteres"
            required
            type="password"
          />
          <TextField
            autoComplete="new-password"
            icon="lock"
            label="Confirme a senha"
            name="confirm"
            required
            type="password"
          />
        </>
      )}
      {!termsAccepted && (
        <label className="checkbox terms-check">
          <input name="terms" required type="checkbox" />
          <span>
            Li e concordo com os{" "}
            <Link href="/termos" rel="noreferrer" target="_blank">
              Termos de Uso
            </Link>{" "}
            e com a{" "}
            <Link href="/privacidade" rel="noreferrer" target="_blank">
              Política de Privacidade
            </Link>
            .
          </span>
        </label>
      )}
      <Button className="full-button button-lg" loading={pending} disabled={pending} type="submit">
        Aceitar convite
      </Button>
    </form>
  )
}
