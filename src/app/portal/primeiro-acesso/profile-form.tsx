"use client"

import { useActionState, useRef, useState } from "react"
import { BankFields, type BankValues } from "@/components/bank-fields"
import { Button, Icon, TextField } from "@/figma/ui"
import { UFS } from "@/lib/br-states"
import { isValidCnpj, onlyDigits } from "@/lib/cnpj"
import { maskAccount, maskAgency, maskBankCode, maskCep, maskCnpj, maskPhone } from "@/lib/masks"
import { saveProfile } from "./actions"

type Values = Record<string, string>
type Lookup = { state: "idle" | "loading" | "ok" | "error"; message?: string }

const FIELDS = ["cnpj", "legalName", "tradeName", "phone", "zipCode", "street", "number", "complement", "district", "city", "state", "bankCode", "bankName", "bankAgency", "bankAccount", "bankAccountType", "pixKey"] as const

async function lookup<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

type CnpjResult = {
  found: boolean
  legalName?: string
  tradeName?: string
  phone?: string
  zipCode?: string
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  situation?: string
}
type CepResult = { found: boolean; street?: string; district?: string; city?: string; state?: string }

export function ProfileForm({
  saved,
  submitLabel,
  initialLocked,
}: {
  saved: Values
  submitLabel: string
  initialLocked: string[]
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined)

  // campos controlados: as consultas de CNPJ e CEP preenchem o formulário
  const [f, setF] = useState<Values>(() => ({
    ...Object.fromEntries(FIELDS.map((k) => [k, state?.values?.[k] ?? saved[k] ?? ""])),
    cnpj: maskCnpj(saved.cnpj ?? ""),
    phone: maskPhone(saved.phone ?? ""),
    zipCode: maskCep(saved.zipCode ?? ""),
    bankCode: maskBankCode(saved.bankCode ?? ""),
    bankAgency: maskAgency(saved.bankAgency ?? ""),
    bankAccount: maskAccount(saved.bankAccount ?? ""),
  }))
  const [cnpjLookup, setCnpjLookup] = useState<Lookup>({ state: "idle" })
  const [cepLookup, setCepLookup] = useState<Lookup>({ state: "idle" })
  const lastCnpj = useRef(onlyDigits(saved.cnpj ?? ""))
  const lastCep = useRef(onlyDigits(saved.zipCode ?? ""))

  // campos que vieram da Receita Federal: somente leitura (o servidor também impõe isso)
  const [locked, setLockedState] = useState<Set<string>>(() => new Set(initialLocked))
  const lockedRef = useRef(locked)
  const setLocked = (next: Set<string>) => {
    lockedRef.current = next
    setLockedState(next)
  }
  const isLocked = (key: string) => locked.has(key)

  const set = (key: string) => (value: string) => setF((prev) => ({ ...prev, [key]: value }))
  // só preenche o que a consulta trouxe, sem apagar o que já está digitado
  const fill = (data: Record<string, string | undefined>, skipLocked = false) =>
    setF((prev) => ({
      ...prev,
      ...(Object.fromEntries(
        Object.entries(data).filter(([k, v]) => v && !(skipLocked && lockedRef.current.has(k))),
      ) as Values),
    }))

  // CNPJ mudou ou a consulta falhou: solta e limpa o que tinha vindo da consulta anterior
  const releaseLocked = () => {
    if (lockedRef.current.size === 0) return
    const cleared = Object.fromEntries([...lockedRef.current].filter((k) => k !== "cnpj").map((k) => [k, ""]))
    setF((prev) => ({ ...prev, ...cleared }))
    setLocked(new Set())
  }

  const onCnpj = async (value: string) => {
    set("cnpj")(value)
    const digits = onlyDigits(value)
    if (digits.length < 14) {
      lastCnpj.current = ""
      releaseLocked()
      setCnpjLookup({ state: "idle" })
      return
    }
    if (digits === lastCnpj.current) return
    lastCnpj.current = digits
    releaseLocked()

    if (!isValidCnpj(digits)) return setCnpjLookup({ state: "error", message: "CNPJ inválido." })

    setCnpjLookup({ state: "loading" })
    const data = await lookup<CnpjResult>(`/api/lookup/cnpj/${digits}`)
    if (lastCnpj.current !== digits) return // a pessoa já mudou o CNPJ
    if (!data?.found) {
      return setCnpjLookup({
        state: "error",
        message: "Não conseguimos confirmar esse CNPJ na Receita Federal. Confira o número e tente de novo.",
      })
    }

    lastCep.current = onlyDigits(data.zipCode ?? "")
    fill({
      legalName: data.legalName,
      tradeName: data.tradeName,
      phone: data.phone ? maskPhone(data.phone) : undefined,
      zipCode: data.zipCode ? maskCep(data.zipCode) : undefined,
      street: data.street,
      number: data.number,
      complement: data.complement,
      district: data.district,
      city: data.city,
      state: data.state,
    })
    // o que a Receita informou fica travado
    const fromReceita = ["legalName", "tradeName", "phone", "zipCode", "street", "number", "complement", "district", "city", "state"] as const
    setLocked(new Set(fromReceita.filter((k) => data[k])))
    const situation = data.situation && data.situation !== "ATIVA" ? ` Atenção: situação cadastral ${data.situation.toLowerCase()}.` : ""
    setCnpjLookup({ state: "ok", message: `Dados preenchidos pela Receita Federal.${situation}` })
  }

  const onCep = async (value: string) => {
    set("zipCode")(value)
    const digits = onlyDigits(value)
    if (digits.length < 8) {
      lastCep.current = ""
      setCepLookup({ state: "idle" })
      return
    }
    if (digits === lastCep.current) return
    lastCep.current = digits

    setCepLookup({ state: "loading" })
    const data = await lookup<CepResult>(`/api/lookup/cep/${digits}`)
    if (lastCep.current !== digits) return
    if (!data?.found) return setCepLookup({ state: "error", message: "CEP não encontrado. Preencha o endereço manualmente." })

    fill({ street: data.street, district: data.district, city: data.city, state: data.state }, true)
    setCepLookup({ state: "ok" })
    document.getElementsByName("number")[0]?.focus() // falta só o número
  }

  const hint = (l: Lookup, okText?: string) =>
    l.state === "loading" ? "Buscando…" : l.state === "ok" ? (l.message ?? okText) : undefined

  return (
    <form action={action} style={{ display: "grid", gap: 20 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}

      <TextField
        autoComplete="off"
        error={cnpjLookup.state === "error" ? cnpjLookup.message : undefined}
        hint={
          isLocked("cnpj")
            ? "O CNPJ não pode ser alterado depois do cadastro."
            : (hint(cnpjLookup) ?? "Comece pelo CNPJ: preenchemos os dados da empresa e o endereço para você.")
        }
        icon={isLocked("cnpj") ? "lock" : undefined}
        label="CNPJ"
        mask="cnpj"
        name="cnpj"
        onValueChange={onCnpj}
        placeholder="00.000.000/0000-00"
        readOnly={isLocked("cnpj")}
        required
        value={f.cnpj}
      />
      {locked.size > 0 && (
        <p className="form-hint">
          <Icon name="lock" size={14} /> Os campos com cadeado vieram da Receita Federal e não podem ser alterados. Se algum estiver
          desatualizado, regularize na Receita ou fale com a empresa contratante.
        </p>
      )}
      <div className="form-grid">
        <TextField icon={isLocked("legalName") ? "lock" : undefined} label="Razão social" name="legalName" onValueChange={set("legalName")} readOnly={isLocked("legalName")} required value={f.legalName} />
        <TextField icon={isLocked("tradeName") ? "lock" : undefined} label="Nome fantasia (opcional)" name="tradeName" onValueChange={set("tradeName")} readOnly={isLocked("tradeName")} value={f.tradeName} />
        <TextField icon={isLocked("phone") ? "lock" : undefined} label="Telefone" mask="phone" name="phone" onValueChange={set("phone")} placeholder="(11) 90000-0000" readOnly={isLocked("phone")} required type="tel" value={f.phone} />
      </div>

      <strong>Endereço</strong>
      <div className="form-grid">
        <TextField
          autoComplete="postal-code"
          error={cepLookup.state === "error" ? cepLookup.message : undefined}
          hint={hint(cepLookup)}
          icon={isLocked("zipCode") ? "lock" : undefined}
          label="CEP"
          mask="cep"
          name="zipCode"
          onValueChange={onCep}
          placeholder="00000-000"
          readOnly={isLocked("zipCode")}
          required
          value={f.zipCode}
        />
        <TextField autoComplete="address-line1" icon={isLocked("street") ? "lock" : undefined} label="Rua" name="street" onValueChange={set("street")} readOnly={isLocked("street")} required value={f.street} />
        <TextField icon={isLocked("number") ? "lock" : undefined} label="Número" name="number" onValueChange={set("number")} readOnly={isLocked("number")} required value={f.number} />
        <TextField icon={isLocked("complement") ? "lock" : undefined} label="Complemento (opcional)" name="complement" onValueChange={set("complement")} readOnly={isLocked("complement")} value={f.complement} />
        <TextField icon={isLocked("district") ? "lock" : undefined} label="Bairro" name="district" onValueChange={set("district")} readOnly={isLocked("district")} required value={f.district} />
        <TextField icon={isLocked("city") ? "lock" : undefined} label="Cidade" name="city" onValueChange={set("city")} readOnly={isLocked("city")} required value={f.city} />
        <label className="field">
          <span className="field-label">Estado</span>
          <span className="field-control field-select">
            {isLocked("state") && <input name="state" type="hidden" value={f.state} />}
            <select disabled={isLocked("state")} name={isLocked("state") ? undefined : "state"} onChange={(e) => set("state")(e.target.value)} required value={f.state}>
              <option value="">Selecione</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={16} />
          </span>
        </label>
      </div>

      <strong>Dados bancários</strong>
      <p className="form-hint" style={{ marginTop: -12 }}>
        Para os pagamentos. A conta precisa ser da sua empresa (mesmo CNPJ).
      </p>
      <BankFields onChange={(patch) => setF((prev) => ({ ...prev, ...patch }))} values={f as BankValues} />

      <div className="portal-form-actions">
        <Button disabled={pending} loading={pending} type="submit">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
