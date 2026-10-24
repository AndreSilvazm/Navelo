"use client"

import { useActionState } from "react"
import { Button, TextField } from "@/figma/ui"
import { updateTradeName } from "./company-actions"

export function CompanyForm({ tradeName, canEdit }: { tradeName: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateTradeName, undefined)

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
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
      <TextField
        defaultValue={tradeName}
        readOnly={!canEdit}
        hint="Como a empresa aparece para os colaboradores e nos convites."
        label="Nome da empresa"
        name="tradeName"
        placeholder="Ex.: Acme"
      />
      {canEdit && (
        <div className="portal-form-actions" style={{ marginTop: 0 }}>
          <Button disabled={pending} loading={pending} type="submit">
            Salvar
          </Button>
        </div>
      )}
    </form>
  )
}
