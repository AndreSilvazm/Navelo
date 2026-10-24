"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { Badge, Button } from "@/figma/ui"
import { formatCnpj } from "@/lib/cnpj"
import { formatBRL, formatDate } from "@/lib/format"
import type { CnpjFlag, CnpjReportResponse } from "./types"

const fetchReport = async (id: string, fresh: boolean): Promise<CnpjReportResponse> => {
  const res = await fetch(`/api/colaboradores/${id}/cnpj${fresh ? "?fresh=1" : ""}`)
  if (!res.ok) throw new Error("Falha na consulta")
  return res.json()
}

function years(openedAt: string) {
  const days = Math.floor((Date.now() - new Date(openedAt).getTime()) / 86_400_000)
  if (days < 60) return `${days} dias`
  if (days < 730) return `${Math.floor(days / 30)} meses`
  return `${Math.floor(days / 365)} anos`
}

function Fact({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="cnpj-fact">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  )
}

function Flag({ flag }: { flag: CnpjFlag }) {
  return (
    <li className={`cnpj-flag ${flag.level}`}>
      <strong>{flag.title}</strong>
      <span>{flag.detail}</span>
    </li>
  )
}

const badge = {
  ok: { label: "Regular", tone: "success" },
  warning: { label: "Revisar", tone: "warning" },
  danger: { label: "Atenção", tone: "danger" },
} as const

// Consulta pública do CNPJ (Receita Federal) no topo da página do colaborador:
// situação cadastral, dados da empresa e alertas. Pode ser recolhida.
export function CnpjPanel({ collaboratorId, cnpj }: { collaboratorId: string; cnpj: string | null }) {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(false) // começa recolhido: o resumo aparece na linha do CNPJ
  const key = ["cnpj-report", collaboratorId, cnpj] as const

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => fetchReport(collaboratorId, false),
    enabled: !!cnpj,
    staleTime: 60 * 60_000, // dado público: não precisa consultar de novo a cada visita
  })

  const refresh = async () => {
    setRefreshing(true)
    try {
      queryClient.setQueryData(key, await fetchReport(collaboratorId, true)) // ignora o cache do servidor
    } finally {
      setRefreshing(false)
    }
  }

  const report = data?.status === "ok" ? data.report : null
  const notFound = data?.status === "not_found"
  const level = notFound
    ? "danger"
    : !report
      ? null
      : report.flags.some((f) => f.level === "danger")
        ? "danger"
        : report.flags.some((f) => f.level === "warning")
          ? "warning"
          : "ok"

  // linha de resumo (aparece com os detalhes ocultos)
  const alerts = report ? report.flags.filter((f) => f.level !== "info").length : 0
  const summary = report
    ? `${report.situation.charAt(0)}${report.situation.slice(1).toLowerCase()} · ${alerts === 0 ? "nenhum alerta" : `${alerts} alerta${alerts > 1 ? "s" : ""}`}`
    : notFound
      ? "CNPJ não encontrado"
      : null

  let body: ReactNode
  if (!cnpj) {
    body = <p className="form-hint">O colaborador ainda não informou o CNPJ. A consulta pública roda assim que ele preencher os dados.</p>
  } else if (isPending) {
    body = <p className="form-hint">Consultando a Receita Federal…</p>
  } else if (isError || data?.status === "unavailable") {
    body = (
      <p className="form-hint">
        A consulta pública está indisponível agora.{" "}
        <button className="doc-review-next" onClick={() => refetch()} type="button">
          Tentar de novo
        </button>
      </p>
    )
  } else if (notFound) {
    body = (
      <ul className="cnpj-flags">
        <Flag flag={{ level: "danger", title: "CNPJ não encontrado", detail: "A consulta pública não encontrou esse CNPJ. Confirme o número informado." }} />
      </ul>
    )
  } else if (report) {
    const situation = `${report.situation.charAt(0)}${report.situation.slice(1).toLowerCase()}`
    body = (
      <>
        <div className="cnpj-facts">
          <Fact label="Situação cadastral" value={`${situation}${report.situationDate ? ` · desde ${formatDate(report.situationDate)}` : ""}`} />
          <Fact label="Abertura" value={report.openedAt ? `${formatDate(report.openedAt)} · ${years(report.openedAt)}` : null} />
          <Fact label="Porte" value={report.size} />
          <Fact label="Regime" value={report.regime} />
          <Fact label="Natureza jurídica" value={report.legalNature} />
          <Fact label="Capital social" value={report.capital !== null ? formatBRL(report.capital * 100) : null} />
          <Fact label="Tipo" value={report.branch} />
          <Fact label="Município" value={[report.city, report.state].filter(Boolean).join("/")} />
        </div>

        <div className="cnpj-section">
          <Fact label="Atividade principal" value={report.mainActivity} />
        </div>

        {report.partners.length > 0 && (
          <div className="cnpj-section">
            <details className="cnpj-partners">
              <summary>Quadro societário ({report.partners.length})</summary>
              <ul>
                {report.partners.map((p) => (
                  <li key={`${p.name}-${p.since}`}>
                    <strong>{p.name}</strong>
                    <span>
                      {p.role ?? "—"}
                      {p.since && ` · desde ${formatDate(p.since)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        <div className="cnpj-section cnpj-foot">
          {report.flags.length === 0 ? (
            <p className="cnpj-clear">Nenhum alerta na consulta pública</p>
          ) : (
            <ul className="cnpj-flags">
              {report.flags.map((f) => (
                <Flag flag={f} key={f.title} />
              ))}
            </ul>
          )}
          <small>
            Fonte: Receita Federal · Atualizado em {new Date(report.fetchedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. Não substitui certidões.
          </small>
        </div>
      </>
    )
  }

  return (
    <section className="cnpj-panel">
      <header className="cnpj-head">
        <div className="cnpj-title">
          <small>Consulta do CNPJ</small>
          <strong>{cnpj ? formatCnpj(cnpj) : "CNPJ não informado"}</strong>
          {!open && summary && <span>{summary}</span>}
        </div>
        <div className="cnpj-actions">
          {level && <Badge tone={badge[level].tone}>{badge[level].label}</Badge>}
          {cnpj && open && (
            <Button disabled={refreshing || isPending} loading={refreshing} onClick={refresh} variant="ghost">
              Atualizar
            </Button>
          )}
          <button aria-expanded={open} className="cnpj-toggle" onClick={() => setOpen((o) => !o)} type="button">
            {open ? "Ocultar detalhes" : "Mostrar detalhes"}
          </button>
        </div>
      </header>
      {open && <div className="cnpj-body">{body}</div>}
    </section>
  )
}
