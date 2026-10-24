"use client"

import { startTransition, useActionState } from "react"
import { Button } from "@/figma/ui"
import { ContractFields, type ContractFieldValues } from "../contract-fields"
import { updateContract } from "../actions"

export function EditContractForm({
  contractId,
  values,
  members,
}: {
  contractId: string
  values: ContractFieldValues
  members: { id: string; label: string }[]
}) {
  const [state, action, pending] = useActionState(updateContract.bind(null, contractId), undefined)

  return (
    <form
      // envio à mão: o formulário não é reiniciado se houver erro
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      style={{ display: "grid", gap: 20 }}
    >
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
      <ContractFields members={members} values={values} />
      <div className="portal-form-actions" style={{ marginTop: 0 }}>
        <Button disabled={pending} loading={pending} type="submit">
          Salvar alterações
        </Button>
      </div>
    </form>
  )
}
