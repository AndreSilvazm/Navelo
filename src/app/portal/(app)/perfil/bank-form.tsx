"use client"

import { startTransition, useActionState, useState } from "react"
import { Button } from "@/figma/ui"
import { BankFields, type BankValues } from "@/components/bank-fields"
import { updateBankData } from "./actions"

export function BankForm({ initial }: { initial: BankValues }) {
  const [state, action, pending] = useActionState(updateBankData, undefined)
  const [values, setValues] = useState<BankValues>(initial)

  return (
    <form
      // envio à mão: o formulário não é reiniciado depois do envio
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      style={{ display: "grid", gap: 16 }}
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
      <BankFields onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))} values={values} />
      <div className="portal-form-actions" style={{ marginTop: 0 }}>
        <Button disabled={pending} loading={pending} type="submit">
          Salvar dados bancários
        </Button>
      </div>
    </form>
  )
}
