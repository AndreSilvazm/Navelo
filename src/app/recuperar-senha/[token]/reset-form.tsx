"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Button, TextField } from "@/figma/ui"
import { PASSWORD_HINT } from "@/lib/auth/password-rules"
import { resetPassword } from "../actions"

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, token), undefined)

  // sem erro depois de enviar: a senha foi trocada
  if (state && !state.error) {
    return (
      <>
        <p className="form-hint" role="status" style={{ color: "var(--zn-success)" }}>
          Senha trocada. Por segurança, encerramos as sessões abertas em todos os aparelhos.
        </p>
        <Button className="full-button button-lg" href="/login">
          Entrar com a nova senha
        </Button>
      </>
    )
  }

  return (
    <form action={action} style={{ display: "grid", gap: 20 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      <TextField
        autoComplete="new-password"
        hint={PASSWORD_HINT}
        icon="lock"
        label="Nova senha"
        name="password"
        required
        type="password"
      />
      <TextField autoComplete="new-password" icon="lock" label="Confirme a nova senha" name="confirm" required type="password" />
      <Button className="full-button button-lg" disabled={pending} loading={pending} type="submit">
        Salvar nova senha
      </Button>
      <p className="signup-link">
        <Link href="/login">Voltar para o login</Link>
      </p>
    </form>
  )
}
