"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Button, TextField } from "@/figma/ui"
import { requestPasswordReset } from "./actions"

export function RequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  if (state?.sent) {
    return (
      <>
        <p className="form-hint" role="status">
          Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por 60 minutos e só pode ser
          usado uma vez. Confira também a caixa de spam.
        </p>
        <p className="signup-link">
          <Link href="/login">Voltar para o login</Link>
        </p>
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
        autoComplete="email"
        icon="mail"
        label="E-mail"
        name="email"
        placeholder="voce@empresa.com.br"
        required
        type="email"
      />
      <Button className="full-button button-lg" disabled={pending} loading={pending} type="submit">
        Enviar link
      </Button>
      <p className="signup-link">
        <Link href="/login">Voltar para o login</Link>
      </p>
    </form>
  )
}
