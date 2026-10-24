"use client"

import { useId, useMemo, useState } from "react"
import banks from "@/lib/banks.json"
import logos from "@/lib/bank-logos.json"
import { BankLogo } from "./bank-logo"

type Bank = { c: string; n: string; f: string }
const all = banks as Bank[]
const withLogo = logos as Record<string, string>

// sem acento e em minúsculas: "Itaú" encontra "itau"
const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

const index = all.map((b) => ({ bank: b, name: norm(b.n), full: norm(b.f) }))

function search(query: string, limit = 8): Bank[] {
  const q = norm(query)
  if (!q) return []
  return index
    .map((i) => {
      // quanto menor, melhor: começa com o termo < palavra começa < contém
      let score = 99
      if (i.bank.c === q.padStart(3, "0") || i.bank.c.startsWith(q)) score = /^\d+$/.test(q) ? 0 : 99
      else if (i.name.startsWith(q)) score = 1
      else if (i.name.split(" ").some((w) => w.startsWith(q))) score = 2
      else if (i.name.includes(q)) score = 3
      else if (i.full.split(" ").some((w) => w.startsWith(q))) score = 4
      else if (i.full.includes(q)) score = 5
      // bancos conhecidos (com logo) primeiro dentro da mesma pontuação
      return { bank: i.bank, score: score * 2 + (withLogo[i.bank.c] ? 0 : 1) }
    })
    .filter((r) => r.score < 99 * 2)
    .sort((a, b) => a.score - b.score || a.bank.n.localeCompare(b.bank.n, "pt-BR"))
    .slice(0, limit)
    .map((r) => r.bank)
}

// Busca de banco pelo nome (ou código): o usuário digita "itau", "nubank", "bradesco"...
// e escolhe na lista. Padrão da plataforma para selecionar instituição.
export function BankPicker({ onSelect }: { onSelect: (bank: { code: string; name: string }) => void }) {
  const listId = useId()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const results = useMemo(() => search(query), [query])

  const choose = (b: Bank) => {
    onSelect({ code: b.c, name: b.n })
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="bank-picker">
      <label className="field">
        <span className="field-label">Buscar banco pelo nome</span>
        <span className="field-control">
          <svg aria-hidden="true" className="icon" height="18" viewBox="0 0 24 24" width="18">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            aria-activedescendant={open && results[active] ? `${listId}-${results[active].c}` : undefined}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open && results.length > 0}
            autoComplete="off"
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === "Enter" && open && results[active]) {
                e.preventDefault() // não envia o formulário
                choose(results[active])
              } else if (e.key === "Escape") setOpen(false)
            }}
            placeholder="Digite o nome: Itaú, Nubank, Bradesco…"
            role="combobox"
            value={query}
          />
        </span>
      </label>

      {open && query.trim() && (
        <ul className="bank-picker-list" id={listId} role="listbox">
          {results.length === 0 ? (
            <li className="bank-picker-empty">Nenhum banco encontrado. Digite o código do banco abaixo.</li>
          ) : (
            results.map((b, i) => (
              <li
                aria-selected={i === active}
                id={`${listId}-${b.c}`}
                key={b.c}
                // mouseDown (e não click): roda antes do campo perder o foco
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(b)
                }}
                onMouseEnter={() => setActive(i)}
                role="option"
              >
                <BankLogo code={b.c} name={b.n} size={28} />
                <span>
                  <strong>{b.n}</strong>
                  <small>{b.f}</small>
                </span>
                <em>{b.c}</em>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
