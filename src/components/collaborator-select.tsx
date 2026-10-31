"use client"

import { Select } from "antd"
import { useMemo, useState } from "react"
import type { PickerOption } from "@/components/collaborator-picker"
import { fold, searchTerms } from "@/lib/search"

/**
 * Escolha de UM colaborador com busca por nome, empresa, cargo ou CNPJ (com ou sem pontuação, sem
 * diferenciar acento). O valor escolhido vai no formulário como um campo oculto `name`.
 */
export function CollaboratorSelect({
  options,
  name = "collaboratorId",
  initial = "",
  placeholder = "Busque por nome ou CNPJ",
}: {
  options: PickerOption[]
  name?: string
  initial?: string
  placeholder?: string
}) {
  const [value, setValue] = useState(initial)

  const items = useMemo(
    () =>
      options.map((o) => {
        const text = `${o.label} ${o.hint ?? ""} ${o.keywords ?? ""}`
        return {
          value: o.id,
          shortLabel: o.label, // o que aparece no campo depois de escolher
          // o que a busca enxerga: o texto sem acento + só os dígitos (acha "45092137" e "45.092.137")
          search: `${fold(text)} ${text.replace(/\D/g, "")}`,
          label: (
            <div style={{ display: "grid", lineHeight: 1.3 }}>
              <strong>{o.label}</strong>
              {o.hint && <span className="form-hint">{o.hint}</span>}
            </div>
          ),
        }
      }),
    [options],
  )

  return (
    <>
      <input name={name} type="hidden" value={value} />
      <Select
        allowClear
        aria-label="Colaborador"
        filterOption={(input, option) => {
          const terms = searchTerms(input)
          const search = (option as { search?: string } | undefined)?.search ?? ""
          return terms.every((t) => search.includes(t))
        }}
        notFoundContent="Nenhum colaborador encontrado"
        onChange={(v) => setValue(v ?? "")}
        optionLabelProp="shortLabel"
        options={items}
        placeholder={placeholder}
        showSearch
        size="large"
        style={{ width: "100%" }}
        value={value || undefined}
      />
    </>
  )
}
