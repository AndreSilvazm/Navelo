"use client"

import { useActionState } from "react"
import { Button } from "@/figma/ui"
import { CollaboratorPicker, type PickerOption } from "@/components/collaborator-picker"
import { addContractCollaborators } from "../actions"

export function AddCollaborators({ contractId, options }: { contractId: string; options: PickerOption[] }) {
  const [state, action, pending] = useActionState(addContractCollaborators.bind(null, contractId), undefined)

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
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
      {/* a chave refaz o seletor (e limpa a seleção) quando a lista disponível muda */}
      <CollaboratorPicker
        emptyText="Todos os colaboradores ativos já estão neste contrato."
        key={options.map((o) => o.id).join(",")}
        options={options}
      />
      {options.length > 0 && (
        <div className="portal-form-actions" style={{ marginTop: 0 }}>
          <Button disabled={pending} icon="plus" loading={pending} type="submit">
            Adicionar ao contrato
          </Button>
        </div>
      )}
    </form>
  )
}
