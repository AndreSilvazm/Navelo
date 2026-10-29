"use client"

import { startTransition, useActionState, useState } from "react"
import { Badge, Button } from "@/figma/ui"
import { BankFields, type BankValues } from "@/components/bank-fields"
import { cancelBankChange, requestBankChange } from "./actions"

export type PendingBankChange = { values: BankValues; createdAt: string }

export function BankForm({ initial, pending: pendingChange, rejected }: { initial: BankValues; pending: PendingBankChange | null; rejected: { note: string | null; at: string } | null }) {
  const [state, action, pending] = useActionState(requestBankChange, undefined)
  const [values, setValues] = useState<BankValues>(initial)
  const [canceling, setCanceling] = useState(false)

  // já existe pedido em análise: mostra o que foi pedido e deixa cancelar
  if (pendingChange) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div className="mvp-section-heading">
          <div>
            <strong>Troca em análise</strong>
            <span>Enviado em {pendingChange.createdAt}. Enquanto a empresa não aprovar, os pagamentos seguem na conta atual.</span>
          </div>
          <Badge tone="warning">Em análise</Badge>
        </div>
        <dl className="info-grid">
          <div className="info-field">
            <dt>Banco pedido</dt>
            <dd>
              {pendingChange.values.bankCode} · {pendingChange.values.bankName}
            </dd>
          </div>
          <div className="info-field">
            <dt>Tipo de conta</dt>
            <dd>{pendingChange.values.bankAccountType === "savings" ? "Conta poupança" : "Conta corrente"}</dd>
          </div>
          <div className="info-field">
            <dt>Agência</dt>
            <dd>{pendingChange.values.bankAgency}</dd>
          </div>
          <div className="info-field">
            <dt>Conta</dt>
            <dd>{pendingChange.values.bankAccount}</dd>
          </div>
          <div className="info-field info-wide">
            <dt>Chave PIX</dt>
            <dd>{pendingChange.values.pixKey || "Não informada"}</dd>
          </div>
        </dl>
        <div className="portal-form-actions" style={{ marginTop: 0 }}>
          <Button
            disabled={canceling}
            loading={canceling}
            onClick={() => {
              setCanceling(true)
              startTransition(async () => {
                await cancelBankChange()
                setCanceling(false)
              })
            }}
            variant="secondary"
          >
            Cancelar pedido
          </Button>
        </div>
      </div>
    )
  }

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
      {rejected && (
        <p className="form-alert" role="status">
          Seu último pedido de troca foi recusado em {rejected.at}
          {rejected.note ? `: ${rejected.note}` : "."} Você pode corrigir e enviar de novo.
        </p>
      )}
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
      <p className="form-hint">
        A troca de conta passa por análise da empresa. Até a aprovação, os pagamentos continuam indo para a conta atual.
      </p>
      <div className="portal-form-actions" style={{ marginTop: 0 }}>
        <Button disabled={pending} loading={pending} type="submit">
          Enviar para análise
        </Button>
      </div>
    </form>
  )
}
