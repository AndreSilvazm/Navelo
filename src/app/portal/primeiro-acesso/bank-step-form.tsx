"use client"

import { useActionState, useState } from "react"
import { BankFields, type BankValues } from "@/components/bank-fields"
import { Button } from "@/figma/ui"
import { maskAccount, maskAgency, maskBankCode } from "@/lib/masks"
import { saveBankStep } from "./actions"

const empty: BankValues = { bankCode: "", bankName: "", bankAgency: "", bankAccount: "", bankAccountType: "", pixKey: "" }

const masked = (v: BankValues): BankValues => ({
  ...v,
  bankCode: maskBankCode(v.bankCode),
  bankAgency: maskAgency(v.bankAgency),
  bankAccount: maskAccount(v.bankAccount),
})

// Etapa 2 do cadastro: dados bancários. A conta PJ (da empresa) é obrigatória; a conta pessoa física
// é opcional e quem não quiser agora pode informar depois, pelo perfil.
export function BankStepForm({ pj, pf, submitLabel }: { pj: BankValues; pf: BankValues | null; submitLabel: string }) {
  const [state, action, pending] = useActionState(saveBankStep, undefined)
  // depois de um erro volta o que a pessoa tinha digitado
  const typed = state?.values
  const fromTyped = (prefix: string): BankValues => ({
    bankCode: typed?.[`${prefix}bankCode`] ?? "",
    bankName: typed?.[`${prefix}bankName`] ?? "",
    bankAgency: typed?.[`${prefix}bankAgency`] ?? "",
    bankAccount: typed?.[`${prefix}bankAccount`] ?? "",
    bankAccountType: typed?.[`${prefix}bankAccountType`] ?? "",
    pixKey: typed?.[`${prefix}pixKey`] ?? "",
  })
  const [pjValues, setPj] = useState<BankValues>(() => masked(typed ? fromTyped("") : pj))
  const [withPf, setWithPf] = useState<boolean>(() => (typed ? typed.pfEnabled === "on" : pf !== null))
  const [pfValues, setPf] = useState<BankValues>(() => masked(typed ? fromTyped("pf_") : (pf ?? empty)))

  return (
    <form action={action} style={{ display: "grid", gap: 20 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <strong>Conta PJ (da sua empresa)</strong>
          <p className="form-hint" style={{ margin: "4px 0 0" }}>
            Obrigatória. É a conta que recebe os pagamentos e precisa ser do seu CNPJ.
          </p>
        </div>
        <BankFields onChange={(patch) => setPj((prev) => ({ ...prev, ...patch }))} values={pjValues} />
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input checked={withPf} name="pfEnabled" onChange={(e) => setWithPf(e.target.checked)} style={{ marginTop: 4 }} type="checkbox" />
          <span>
            <strong>Quero informar também uma conta pessoa física</strong>
            <span className="form-hint" style={{ display: "block", marginTop: 2 }}>
              Opcional. Se preferir, informe depois: dá para adicionar a qualquer momento pelo seu perfil.
            </span>
          </span>
        </label>
        {withPf && <BankFields onChange={(patch) => setPf((prev) => ({ ...prev, ...patch }))} prefix="pf_" values={pfValues} />}
      </section>

      <p className="form-hint">Trocar de conta depois passa por análise da empresa.</p>
      <div className="portal-form-actions">
        <Button href="/portal/primeiro-acesso?etapa=dados" variant="secondary">
          Voltar
        </Button>
        <Button disabled={pending} loading={pending} type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
