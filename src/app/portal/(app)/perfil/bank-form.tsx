"use client"

import { startTransition, useActionState, useState } from "react"
import { Badge, Button } from "@/figma/ui"
import { BankFields, type BankValues } from "@/components/bank-fields"
import { cancelBankChange, requestBankChange } from "./actions"

export type PendingBankChange = { values: BankValues; createdAt: string }

const FIELDS = ["bankCode", "bankName", "bankAgency", "bankAccount", "bankAccountType", "pixKey"] as const

// Formulário de uma das contas do perfil: "pj" (da empresa) ou "pf" (pessoa física). Trocar uma conta
// que já existe, ou cadastrar a conta pessoal depois, passa por análise da empresa.
export function BankForm({
  kind,
  hasAccount,
  initial,
  pending: pendingChange,
  rejected,
}: {
  kind: "pj" | "pf"
  /** já existe uma conta deste tipo em vigor (então o pedido é uma troca) */
  hasAccount: boolean
  initial: BankValues
  pending: PendingBankChange | null
  rejected: { note: string | null; at: string } | null
}) {
  const [state, action, pending] = useActionState(requestBankChange, undefined)
  const [values, setValues] = useState<BankValues>(initial)
  const [canceling, setCanceling] = useState(false)
  // o formulário do PF usa nomes com prefixo, para não bater com os do PJ na mesma página
  const prefix = kind === "pf" ? "pf_" : ""

  // já existe pedido em análise: mostra o que foi pedido e deixa cancelar
  if (pendingChange) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div className="mvp-section-heading">
          <div>
            <strong>{hasAccount ? "Troca em análise" : "Cadastro em análise"}</strong>
            <span>
              Enviado em {pendingChange.createdAt}.{" "}
              {hasAccount ? "Enquanto a empresa não aprovar, os pagamentos seguem na conta atual." : "A conta só vale depois que a empresa aprovar."}
            </span>
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
                await cancelBankChange(kind)
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
        if (prefix) for (const f of FIELDS) data.set(f, String(data.get(`${prefix}${f}`) ?? ""))
        data.set("kind", kind)
        startTransition(() => action(data))
      }}
      style={{ display: "grid", gap: 16 }}
    >
      {rejected && (
        <p className="form-alert" role="status">
          Seu último pedido foi recusado em {rejected.at}
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
      <BankFields onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))} prefix={prefix} values={values} />
      <p className="form-hint">
        {hasAccount
          ? "A troca de conta passa por análise da empresa. Até a aprovação, os pagamentos continuam indo para a conta atual."
          : "O cadastro desta conta passa por análise da empresa antes de valer."}
      </p>
      <div className="portal-form-actions" style={{ marginTop: 0 }}>
        <Button disabled={pending} loading={pending} type="submit">
          {hasAccount ? "Enviar troca para análise" : "Enviar para análise"}
        </Button>
      </div>
    </form>
  )
}
