"use client"

import { useMemo, useState } from "react"
import { Icon } from "@/figma/ui"
import { fold, searchTerms } from "@/lib/search"

type Part = string | number | null | undefined

/**
 * Busca em memória para tabelas com poucas linhas por tela. Cada palavra digitada precisa aparecer
 * em algum campo, sem diferenciar acento nem maiúscula. Campos de CNPJ entram também só com os
 * dígitos, então "45.092.137" e "45092137" acham o mesmo CNPJ.
 */
export function useTableSearch<T>(rows: T[], parts: (row: T) => Part[]) {
  const [query, setQuery] = useState("")

  const haystacks = useMemo(
    () =>
      rows.map((row) => {
        const texts = parts(row).filter((p): p is string | number => p !== null && p !== undefined && p !== "").map(String)
        // a versão só com dígitos de cada campo (CNPJ, telefone, número de nota) também é pesquisável
        return fold(texts.concat(texts.map((t) => t.replace(/\D/g, "")).filter(Boolean)).join(" | "))
      }),
    [rows, parts],
  )

  const filtered = useMemo(() => {
    const terms = searchTerms(query)
    if (terms.length === 0) return rows
    return rows.filter((_, i) => terms.every((t) => haystacks[i].includes(t)))
  }, [rows, haystacks, query])

  return { query, setQuery, filtered, searching: query.trim().length > 0 }
}

// Caixa de busca no mesmo visual das outras telas (colaboradores, notas fiscais)
export function TableSearch({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <div className="workspace-table-toolbar">
      <div className="table-search" role="search">
        <Icon name="search" size={17} />
        <input aria-label={label} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} value={value} />
      </div>
    </div>
  )
}
