"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Badge, Icon } from "@/figma/ui"
import { formatBRL, formatDate } from "@/lib/format"
import { categoryLabel, reimbursementStatusLabel, reimbursementStatusTone } from "@/lib/reimbursements"
import { analyzeSpending } from "@/lib/spending"
import type { CollaboratorDetailData } from "./types"

const signed = (pct: number) => `${pct > 0 ? "+" : ""}${pct}%`

// Custos do colaborador para a empresa: o que já foi gasto (notas + reembolsos), se o mês fugiu do
// normal, despesas fora do padrão e a projeção do próximo mês. Os cálculos ficam em src/lib/spending.ts.
export function SpendingSection({ data }: { data: CollaboratorDetailData }) {
  // "agora" fixo enquanto a tela está aberta (os cálculos não mudam a cada renderização)
  const [now] = useState(() => new Date())

  const a = useMemo(
    () =>
      analyzeSpending({
        now,
        monthlyAgreedCents: data.monthlyAmountCents,
        invoices: data.invoices.map((i) => ({ amountCents: i.amountCents, competence: i.competence, status: i.status })),
        reimbursements: data.reimbursements.map((r) => ({ id: r.id, amountCents: r.amountCents, expenseDate: r.expenseDate, category: r.category, status: r.status })),
      }),
    [data, now],
  )

  const peak = Math.max(...a.series.map((p) => p.total), 1)
  const recent = data.reimbursements.slice(0, 5)
  const inReview = data.reimbursements.filter((r) => r.status === "submitted")
  const v = a.reimbursementVsAvg
  const hasAny = data.reimbursements.length > 0 || data.invoices.length > 0

  return (
    <section className="spend">
      <div className="spend-head">
        <h2>Custos e reembolsos</h2>
        <Link className="doc-review-next" href="/app/reembolsos">
          Ver todos os reembolsos →
        </Link>
      </div>

      <div className="dash-kpis">
        <div className="dash-kpi">
          <span className="dash-kpi-label">Total já pago</span>
          <strong>{formatBRL(a.paidTotal)}</strong>
          <small>
            notas {formatBRL(a.paidInvoices)} · reembolsos {formatBRL(a.paidReimbursements)}
          </small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovado, a pagar</span>
          <strong>{formatBRL(a.toPay)}</strong>
          <small>{inReview.length > 0 ? `${inReview.length} reembolso(s) ainda em revisão` : "nada em revisão"}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Gasto neste mês</span>
          <strong>{formatBRL(a.current.total)}</strong>
          <small>
            {a.totalVsPrevious.pct === null ? "sem mês anterior para comparar" : `${signed(a.totalVsPrevious.pct)} contra o mês anterior`}
          </small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Projeção do próximo mês</span>
          <strong>{formatBRL(a.projection.total)}</strong>
          <small>confiança {a.projection.confidence}</small>
        </div>
      </div>

      {!hasAny ? (
        <p className="form-hint">Ainda não há notas nem reembolsos deste colaborador para analisar.</p>
      ) : (
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Gasto por mês</strong>
                <span>Notas e reembolsos aprovados ou pagos, nos últimos 12 meses</span>
              </div>
              <span className="dash-legend">
                <i /> Notas
              </span>
              <span className="dash-legend">
                <i className="reimb" /> Reembolsos
              </span>
            </div>
            <div className="spend-chart" role="img" aria-label="Gasto por mês: notas fiscais e reembolsos">
              {a.series.map((p) => (
                <div className="spend-col" key={p.month} title={`${p.label}: notas ${formatBRL(p.invoices)} · reembolsos ${formatBRL(p.reimbursements)}`}>
                  <div className="spend-stack" style={{ height: `${Math.max(p.total > 0 ? 4 : 0, (p.total / peak) * 100)}%` }}>
                    {p.reimbursements > 0 && <b className="reimb" style={{ flex: p.reimbursements }} />}
                    {p.invoices > 0 && <b style={{ flex: p.invoices }} />}
                  </div>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Próximo mês</strong>
                <span>Projeção de custo</span>
              </div>
            </div>
            <div className="spend-projection">
              <strong>{formatBRL(a.projection.total)}</strong>
              <ul>
                <li>
                  <span>Notas fiscais</span>
                  <b>{formatBRL(a.projection.invoices)}</b>
                </li>
                <li>
                  <span>Reembolsos</span>
                  <b>{formatBRL(a.projection.reimbursements)}</b>
                </li>
              </ul>
              <p className="form-hint">
                {a.projection.note} Notas: valor mensal definido (ou a média recente). Reembolsos: média ponderada dos últimos 3 meses completos.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasAny && (
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Reembolsos fora do normal?</strong>
                <span>O mês atual contra a média dos 3 meses anteriores</span>
              </div>
              {v.verdict === "acima" && <Badge tone="danger">Acima do normal</Badge>}
              {v.verdict === "abaixo" && <Badge tone="info">Abaixo do normal</Badge>}
              {v.verdict === "normal" && <Badge tone="success">Dentro do normal</Badge>}
              {v.verdict === "sem-base" && <Badge tone="neutral">Sem base</Badge>}
            </div>
            {v.verdict === "sem-base" ? (
              <p className="form-hint">Ainda não há reembolsos suficientes nos meses anteriores para comparar.</p>
            ) : (
              <p style={{ margin: "8px 0 0" }}>
                Neste mês: <strong>{formatBRL(a.current.reimbursements)}</strong> em reembolsos. A média dos 3 meses anteriores é{" "}
                <strong>{formatBRL(v.avg)}</strong>
                {v.pct !== null && <> ({signed(v.pct)})</>}.
              </p>
            )}

            <div className="spend-outliers">
              <strong>Despesas fora do padrão (últimos 90 dias)</strong>
              {a.outliers.length === 0 ? (
                <p className="form-hint">Nenhuma despesa muito acima do que este colaborador costuma gastar.</p>
              ) : (
                <ul>
                  {a.outliers.map((o) => (
                    <li key={o.id}>
                      <Icon name="activity" size={16} />
                      <span>
                        <Link href={`/app/reembolsos/${o.id}`}>
                          {categoryLabel(o.category)} de {formatBRL(o.amountCents)}
                        </Link>{" "}
                        em {formatDate(o.expenseDate)}: {o.ratio.toFixed(1).replace(".", ",")}× o valor típico ({formatBRL(o.baselineCents)}).
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Últimos reembolsos</strong>
                <span>Os 5 pedidos mais recentes</span>
              </div>
            </div>
            {recent.length === 0 ? (
              <p className="form-hint">Este colaborador ainda não pediu reembolso.</p>
            ) : (
              <ul className="dash-contracts">
                {recent.map((r) => (
                  <li key={r.id}>
                    <div>
                      <Link href={`/app/reembolsos/${r.id}`}>
                        {categoryLabel(r.category)} · {formatBRL(r.amountCents)}
                      </Link>
                      <small>
                        {formatDate(r.expenseDate)} · {r.description.slice(0, 60)}
                      </small>
                    </div>
                    <Badge tone={reimbursementStatusTone[r.status]}>{reimbursementStatusLabel[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
