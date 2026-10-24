"use client"

import { useActionState } from "react"
import { Button, TextField } from "@/figma/ui"
import { addRequirement } from "./requirements-actions"

export function RequirementForm() {
  const [state, action, pending] = useActionState(addRequirement, undefined)

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="form-hint" role="status">
          {state.success}
        </p>
      )}
      <TextField label="Nome do documento" name="name" placeholder="Ex.: Cartão CNPJ" required />
      <TextField label="Orientação (opcional)" name="description" placeholder="Ex.: emitido há no máximo 90 dias" />
      <label className="checkbox">
        <input defaultChecked name="required" type="checkbox" />
        <span>Obrigatório</span>
      </label>
      <div className="portal-form-actions">
        <Button disabled={pending} icon="plus" loading={pending} type="submit">
          Adicionar documento
        </Button>
      </div>
    </form>
  )
}
