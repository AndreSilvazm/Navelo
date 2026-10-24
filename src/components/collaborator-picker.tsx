"use client"

import { useState } from "react"
import { Icon } from "@/figma/ui"
import { fold, searchTerms } from "@/lib/search"

// `keywords`: tudo que pode ser buscado (pessoa, empresa, cargo, CNPJ), além do que aparece na lista
export type PickerOption = { id: string; label: string; hint?: string; keywords?: string }

// Lista de colaboradores com busca e seleção múltipla. Cada item marcado vai no formulário
// como um campo `name` (padrão: collaboratorIds), então funciona dentro de qualquer <form>.
export function CollaboratorPicker({
  options,
  initialSelected = [],
  name = "collaboratorIds",
  emptyText = "Nenhum colaborador ativo ainda. Convide e libere colaboradores na aba Colaboradores.",
}: {
  options: PickerOption[]
  initialSelected?: string[]
  name?: string
  emptyText?: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [filter, setFilter] = useState("")

  if (options.length === 0) return <p className="form-hint">{emptyText}</p>

  const terms = searchTerms(filter)
  const visible = options.filter((c) => {
    const haystack = fold(`${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`)
    return terms.every((t) => haystack.includes(t))
  })
  // conta só quem ainda está na lista (a lista muda depois de adicionar gente)
  const count = options.filter((o) => selected.has(o.id)).length

  return (
    <>
      <div className="table-search" style={{ marginBottom: 12 }}>
        <Icon name="search" size={17} />
        <input aria-label="Filtrar colaboradores" onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por nome..." value={filter} />
      </div>
      <div className="pick-list">
        {visible.map((c) => (
          <label className="pick-item" key={c.id}>
            <input
              checked={selected.has(c.id)}
              name={name}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (e.target.checked) next.add(c.id)
                  else next.delete(c.id)
                  return next
                })
              }
              type="checkbox"
              value={c.id}
            />
            <span>
              <strong>{c.label}</strong>
              {c.hint && <small>{c.hint}</small>}
            </span>
          </label>
        ))}
        {visible.length === 0 && <p className="form-hint">Nenhum colaborador encontrado.</p>}
      </div>
      <p className="form-hint" style={{ marginTop: 8 }}>
        {count} selecionado(s)
      </p>
    </>
  )
}
