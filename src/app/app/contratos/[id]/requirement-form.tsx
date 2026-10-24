"use client"

import { useActionState } from "react"
import { Button, TextField } from "@/figma/ui"
import { addContractRequirement } from "../actions"

export function RequirementForm({ contractId }: { contractId: string }) {
  const [state, action, pending] = useActionState(addContractRequirement.bind(null, contractId), undefined)

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="form-hint" role="status" style={{ color: "var(--zn-success)" }}>
          {state.success}
        </p>
      )}
      <TextField label="Nome do documento" name="name" placeholder="Ex.: Certidão negativa trabalhista" required />
      <label className="checkbox">
        <input defaultChecked name="required" type="checkbox" />
        <span>Obrigatório</span>
      </label>
      <div className="portal-form-actions" style={{ marginTop: 0 }}>
        <Button disabled={pending} icon="plus" loading={pending} type="submit">
          Adicionar documento
        </Button>
      </div>
    </form>
  )
}
