import { BankLogo } from "@/components/bank-logo"

export type BankAccountView = {
  bankCode: string
  bankName: string
  bankAgency: string
  bankAccount: string
  bankAccountType: "checking" | "savings"
  pixKey: string | null
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="info-field">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

// Os campos de uma conta bancária (a que está em vigor ou a que foi pedida). Serve no servidor e no
// navegador: usado na página do colaborador e na tela de aprovação da nota fiscal.
export function BankAccountFields({
  account,
  label = "Banco",
  holder,
  holderDoc,
  holderDocLabel,
}: {
  account: BankAccountView
  label?: string
  holder?: string | null
  holderDoc?: string | null
  holderDocLabel?: string
}) {
  return (
    <dl className="info-grid">
      <div className="info-field">
        <dt>{label}</dt>
        <dd className="bank-line">
          <BankLogo code={account.bankCode} name={account.bankName} size={32} />
          <span>
            {account.bankCode} · {account.bankName}
          </span>
        </dd>
      </div>
      <Field label="Tipo de conta" value={account.bankAccountType === "savings" ? "Conta poupança" : "Conta corrente"} />
      <Field label="Agência" value={account.bankAgency} />
      <Field label="Conta" value={account.bankAccount} />
      {holder !== undefined && <Field label="Titular" value={holder} />}
      {holderDocLabel && <Field label={holderDocLabel} value={holderDoc} />}
      <div className="info-field info-wide">
        <dt>Chave PIX</dt>
        <dd>{account.pixKey || "Não informada"}</dd>
      </div>
    </dl>
  )
}
