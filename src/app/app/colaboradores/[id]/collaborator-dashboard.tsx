"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { Badge, Button, Icon, TextField, type IconName } from "@/figma/ui"
import { formatBRL, formatDate } from "@/lib/format"
import { maskCurrency } from "@/lib/masks"
import { setMonthlyAmount } from "../actions"
import { detailQueryKey, type CollaboratorDetailData } from "./types"

const DAY = 86_400_000
const MONTH = 30.4375 * DAY

// "3 meses", "1 ano e 2 meses", "12 dias"
function duration(ms: number) {
  const days = Math.floor(ms / DAY)
  if (days < 1) return "menos de 1 dia"
  if (days < 60) return `${days} ${days === 1 ? "dia" : "dias"}`
  const months = Math.floor(ms / MONTH)
  if (months < 24) return `${months} ${months === 1 ? "mês" : "meses"}`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return `${years} anos${rest ? ` e ${rest} ${rest === 1 ? "mês" : "meses"}` : ""}`
}

const contractTone = { active: "success", ended: "neutral", canceled: "danger" } as const
const contractLabel = { active: "Ativo", ended: "Encerrado", canceled: "Cancelado" } as const

function Kpi({ icon, tone, label, value, hint }: { icon: IconName; tone: string; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="dash-kpi">
      <span className={`dash-icon ${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="dash-kpi-label">{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  )
}

// Dashboard do colaborador para a empresa avaliar: quanto paga por mês, há quanto tempo está
// vinculado, em quantos contratos e quanto isso representa. Notas e pagamentos entram quando
// essas funcionalidades existirem.
export function CollaboratorDashboard({ data }: { data: CollaboratorDetailData }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")

  const save = useMutation({
    mutationFn: (value: string) => {
      const form = new FormData()
      form.set("amount", value)
      return setMonthlyAmount(data.id, form)
    },
    onSuccess: async (result) => {
      if (result?.error) return setError(result.error)
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: detailQueryKey(data.id) })
    },
    onError: () => setError("Não foi possível salvar. Tente novamente."),
  })

  const monthly = data.monthlyAmountCents
  // "agora" fixo enquanto a tela está aberta (os cálculos não mudam a cada renderização)
  const [now] = useState(() => Date.now())
  const live = data.contracts.filter((c) => c.status !== "canceled")
  // vínculo = entrada no primeiro contrato (ainda não cancelado)
  const since = live.length ? Math.min(...live.map((c) => new Date(c.linkedAt).getTime())) : null
  const linkedMs = since ? now - since : 0
  const activeContracts = data.contracts.filter((c) => c.status === "active").length
  const forecast = monthly !== null && since ? Math.round(monthly * (linkedMs / MONTH)) : null

  // notas: só as PAGAS contam como valor pago (aprovada ainda não foi paga)
  const paid = data.invoices.filter((i) => i.status === "paid")
  const paidTotal = paid.reduce((t, i) => t + i.amountCents, 0)
  const toPay = data.invoices.filter((i) => i.status === "approved").reduce((t, i) => t + i.amountCents, 0)
  const inReview = data.invoices.filter((i) => i.status === "submitted").length

  // previsto acumulado nos últimos 12 meses (pago entra aqui quando houver pagamentos)
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now)
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - i))
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const linkedDays = since ? Math.max(0, Math.min(end, now) - Math.max(start, since)) : 0
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    return { label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), start, linkedDays, key }
  })
  let running = since && monthly ? Math.round(monthly * (Math.max(0, months[0].start - since) / MONTH)) : 0
  const bars = months.map((m) => {
    running += monthly ? Math.round(monthly * (m.linkedDays / MONTH)) : 0
    // pago acumulado até o mês (pela competência da nota)
    const paidUpTo = paid.filter((i) => i.competence.slice(0, 7) <= m.key).reduce((t, i) => t + i.amountCents, 0)
    return { ...m, cumulative: running, paidUpTo, on: m.linkedDays > 0 }
  })
  const peak = Math.max(...bars.map((b) => Math.max(b.cumulative, b.paidUpTo)), 1)

  return (
    <div className="dash">
      <section className="dash-hero lumen lumen-glow">
        <div className="dash-hero-main">
          <span className="dash-eyebrow">Valor mensal acordado</span>
          {editing ? (
            <form
              className="dash-edit"
              onSubmit={(e) => {
                e.preventDefault()
                setError("")
                save.mutate(amount)
              }}
            >
              <TextField
                autoComplete="off"
                error={error || undefined}
                hint="Quanto a empresa paga por mês a este colaborador. Deixe vazio para remover."
                label="Valor mensal (R$)"
                mask="currency"
                name="amount"
                onValueChange={setAmount}
                placeholder="0,00"
                value={amount}
              />
              <div className="dash-edit-actions">
                <Button disabled={save.isPending} loading={save.isPending} type="submit">
                  Salvar valor
                </Button>
                <Button onClick={() => setEditing(false)} variant="ghost">
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className={`dash-amount ${monthly === null ? "empty" : ""}`}>
                {monthly !== null ? formatBRL(monthly) : "Não definido"}
              </div>
              <p className="dash-sub">
                {monthly !== null && data.monthlyAmountUpdatedAt
                  ? `Definido por ${data.monthlyAmountUpdatedBy ?? "usuário removido"} em ${new Date(data.monthlyAmountUpdatedAt).toLocaleDateString("pt-BR")}`
                  : "Defina quanto a empresa vai pagar por mês a este colaborador. Os comparativos do dashboard partem desse valor."}
              </p>
              <Button
                icon={monthly === null ? "plus" : "gear"}
                onClick={() => {
                  setAmount(monthly !== null ? maskCurrency(String(monthly)) : "")
                  setError("")
                  setEditing(true)
                }}
                variant={monthly === null ? "primary" : "secondary"}
              >
                {monthly === null ? "Definir valor mensal" : "Alterar valor"}
              </Button>
            </>
          )}
        </div>

        <div className="dash-hero-side">
          <div className="dash-chip">
            <span className="dash-icon blue">
              <Icon name="clock" size={18} />
            </span>
            <div>
              <small>Tempo de vínculo</small>
              <strong>{since ? duration(linkedMs) : "Sem contrato"}</strong>
              {since && <small>desde {new Date(since).toLocaleDateString("pt-BR")}</small>}
            </div>
          </div>
          <div className="dash-chip">
            <span className="dash-icon lilac">
              <Icon name="contract" size={18} />
            </span>
            <div>
              <small>Contratos ativos</small>
              <strong>{activeContracts}</strong>
              <small>{data.contracts.length} no histórico</small>
            </div>
          </div>
        </div>
      </section>

      <div className="dash-kpis">
        <Kpi
          hint={monthly !== null ? "valor definido pelo corporativo" : "defina o valor mensal"}
          icon="payment"
          label="Custo mensal"
          tone="blue"
          value={monthly !== null ? formatBRL(monthly) : "—"}
        />
        <Kpi
          hint={since ? "estimativa: valor mensal × tempo de vínculo" : "aparece quando houver contrato"}
          icon="report"
          label="Previsto até hoje"
          tone="lilac"
          value={forecast !== null ? formatBRL(forecast) : "—"}
        />
        <Kpi
          hint={data.invoices.length === 0 ? "nenhuma nota enviada ainda" : `${inReview} em revisão · ${formatBRL(toPay)} aprovado, a pagar`}
          icon="upload"
          label="Notas fiscais geradas"
          tone="amber"
          value={String(data.invoices.length)}
        />
        <Kpi
          hint={paid.length === 0 ? "nenhuma nota paga ainda" : `${paid.length} nota(s) paga(s)`}
          icon="check"
          label="Total pago"
          tone="green"
          value={formatBRL(paidTotal)}
        />
      </div>

      <div className="dash-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <strong>Previsto acumulado</strong>
              <span>Últimos 12 meses, a partir do valor mensal e do vínculo</span>
            </div>
            <span className="dash-legend">
              <i /> Previsto
            </span>
            <span className="dash-legend">
              <i className="paid" /> Pago
            </span>
          </div>
          {(monthly === null || !since) && paidTotal === 0 ? (
            <p className="form-hint" style={{ padding: "32px 0" }}>
              {monthly === null
                ? "Defina o valor mensal para ver a evolução prevista."
                : "O gráfico aparece quando o colaborador entrar em um contrato."}
            </p>
          ) : (
            <div className="dash-chart" role="img" aria-label="Previsto acumulado nos últimos 12 meses">
              {bars.map((b) => (
                <div className={`dash-bar ${b.on || b.cumulative > 0 ? "" : "off"}`} key={b.start} title={`${b.label}: previsto ${formatBRL(b.cumulative)} · pago ${formatBRL(b.paidUpTo)}`}>
                  {b.cumulative > 0 && <em>{b.cumulative >= 1_000_00 ? `${Math.round(b.cumulative / 100_000)}k` : ""}</em>}
                  <i style={{ height: `${Math.max(4, (Math.max(b.cumulative, b.paidUpTo) / peak) * 100)}%` }}>
                    {b.paidUpTo > 0 && <b style={{ height: `${(b.paidUpTo / Math.max(b.cumulative, b.paidUpTo)) * 100}%` }} />}
                  </i>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          )}
          <p className="form-hint" style={{ marginTop: 12 }}>
            O valor pago conta só as notas marcadas como pagas pelo corporativo, pela competência de cada nota.
          </p>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <strong>Contratos</strong>
              <span>Onde este colaborador atua</span>
            </div>
          </div>
          {data.contracts.length === 0 ? (
            <p className="form-hint">Ainda não está em nenhum contrato. Adicione na página do contrato.</p>
          ) : (
            <ul className="dash-contracts">
              {data.contracts.map((c) => (
                <li key={c.id}>
                  <div>
                    <a href={`/app/contratos/${c.id}`}>{c.name}</a>
                    <small>
                      {formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : "indeterminado"} · no contrato há{" "}
                      {duration(now - new Date(c.linkedAt).getTime())}
                    </small>
                  </div>
                  <Badge tone={contractTone[c.status]}>{contractLabel[c.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
