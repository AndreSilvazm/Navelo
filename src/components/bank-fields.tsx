"use client"

import { useRef, useState } from "react"
import { Icon, TextField } from "@/figma/ui"
import { BankLogo } from "./bank-logo"
import { BankPicker } from "./bank-picker"

export type BankValues = {
  bankCode: string
  bankName: string
  bankAgency: string
  bankAccount: string
  bankAccountType: string
  pixKey: string
}

type Lookup = { state: "idle" | "loading" | "ok" | "error"; message?: string }

// Campos dos dados bancários (cadastro inicial e perfil): busca do banco pelo nome ou pelo
// código, logo do banco, agência, conta, tipo e PIX. O estado fica com quem usa (controlado).
export function BankFields({ values, onChange }: { values: BankValues; onChange: (patch: Partial<BankValues>) => void }) {
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" })
  const lastCode = useRef(values.bankCode)

  // escolheu o banco pela busca de nome: preenche código e nome
  const onPick = (bank: { code: string; name: string }) => {
    lastCode.current = bank.code
    setLookup({ state: "ok" })
    onChange({ bankCode: bank.code, bankName: bank.name })
    document.getElementsByName("bankAgency")[0]?.focus()
  }

  // código do banco -> nome do banco (consulta pública)
  const onCode = async (code: string) => {
    onChange({ bankCode: code })
    if (code.length < 3) {
      lastCode.current = ""
      setLookup({ state: "idle" })
      return
    }
    if (code === lastCode.current) return
    lastCode.current = code

    setLookup({ state: "loading" })
    let data: { found?: boolean; name?: string } | null = null
    try {
      const res = await fetch(`/api/lookup/bank/${code}`)
      data = res.ok ? await res.json() : null
    } catch {
      data = null
    }
    if (lastCode.current !== code) return
    if (!data?.found || !data.name) return setLookup({ state: "error", message: "Banco não encontrado. Digite o nome do banco." })
    onChange({ bankName: data.name })
    setLookup({ state: "ok" })
    document.getElementsByName("bankAgency")[0]?.focus()
  }

  return (
    <>
      <BankPicker onSelect={onPick} />
      <div className="form-grid">
        <TextField
          error={lookup.state === "error" ? lookup.message : undefined}
          hint={lookup.state === "loading" ? "Buscando…" : "Ou digite o código, se já souber."}
          label="Código do banco"
          mask="bankCode"
          name="bankCode"
          onValueChange={onCode}
          placeholder="Ex.: 341"
          required
          value={values.bankCode}
        />
        <TextField
          label="Banco"
          leading={values.bankCode.length === 3 ? <BankLogo code={values.bankCode} name={values.bankName} size={22} /> : undefined}
          name="bankName"
          onValueChange={(v) => onChange({ bankName: v })}
          required
          value={values.bankName}
        />
        <TextField label="Agência" mask="agency" name="bankAgency" onValueChange={(v) => onChange({ bankAgency: v })} placeholder="0000" required value={values.bankAgency} />
        <TextField label="Conta (com dígito)" mask="account" name="bankAccount" onValueChange={(v) => onChange({ bankAccount: v })} placeholder="12345-6" required value={values.bankAccount} />
        <label className="field">
          <span className="field-label">Tipo de conta</span>
          <span className="field-control field-select">
            <select name="bankAccountType" onChange={(e) => onChange({ bankAccountType: e.target.value })} required value={values.bankAccountType}>
              <option value="">Selecione</option>
              <option value="checking">Conta corrente</option>
              <option value="savings">Conta poupança</option>
            </select>
            <Icon name="chevron" size={16} />
          </span>
        </label>
        <TextField label="Chave PIX (opcional)" name="pixKey" onValueChange={(v) => onChange({ pixKey: v })} placeholder="CNPJ, e-mail, telefone ou chave aleatória" value={values.pixKey} />
      </div>
    </>
  )
}
