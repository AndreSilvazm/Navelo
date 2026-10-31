// Custos de um colaborador: o que a empresa gastou (notas fiscais + reembolsos), se o mês fugiu do
// normal e uma projeção para o mês que vem. Funções puras, sem servidor: rodam no dashboard.
//
// Como cada número é feito (a tela repete isto em linguagem simples):
// - Gasto do mês = notas aprovadas ou pagas (pela competência) + reembolsos aprovados ou pagos
//   (pela data da despesa). Pedido em revisão ou recusado não entra.
// - "Acima/abaixo do normal" compara o mês atual com a média dos 3 meses completos anteriores.
// - Despesa fora do padrão = reembolso de pelo menos o dobro da mediana do mesmo colaborador na
//   mesma categoria (ou no geral, se a categoria tiver pouco histórico).
// - Projeção do próximo mês = reembolsos: média ponderada dos últimos 3 meses completos (o mais
//   recente pesa 3, depois 2, depois 1); notas: o valor mensal definido, ou a média recente.

export type SpendInvoice = { amountCents: number; competence: string; status: "submitted" | "approved" | "rejected" | "paid" }
export type SpendReimbursement = {
  id: string
  amountCents: number
  expenseDate: string // AAAA-MM-DD
  category: string
  status: "submitted" | "approved" | "rejected" | "paid"
}

export type MonthPoint = { month: string; label: string; invoices: number; reimbursements: number; total: number }

export type Outlier = { id: string; amountCents: number; baselineCents: number; category: string; expenseDate: string; ratio: number }

export type SpendingAnalysis = {
  series: MonthPoint[] // do mais antigo ao mês atual
  /** pago de fato (notas pagas + reembolsos pagos), em todo o histórico */
  paidTotal: number
  paidInvoices: number
  paidReimbursements: number
  /** aprovado e ainda não pago */
  toPay: number
  current: MonthPoint
  previous: MonthPoint
  /** variação dos reembolsos do mês atual contra a média dos 3 meses completos anteriores (null sem base) */
  reimbursementVsAvg: { avg: number; pct: number | null; verdict: "acima" | "abaixo" | "normal" | "sem-base" }
  /** variação do total do mês atual contra o mês anterior */
  totalVsPrevious: { pct: number | null }
  outliers: Outlier[]
  projection: { invoices: number; reimbursements: number; total: number; confidence: "baixa" | "média" | "alta"; note: string }
}

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const keyOf = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`
const counts = (s: string) => s === "approved" || s === "paid"

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

export function analyzeSpending(input: {
  invoices: SpendInvoice[]
  reimbursements: SpendReimbursement[]
  /** valor mensal definido para o colaborador (centavos); entra na projeção das notas */
  monthlyAgreedCents: number | null
  now: Date
  months?: number
}): SpendingAnalysis {
  const { now } = input
  const span = input.months ?? 12

  // série dos últimos `span` meses, terminando no mês atual
  const series: MonthPoint[] = Array.from({ length: span }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (span - 1 - i), 1)
    return { month: keyOf(d.getFullYear(), d.getMonth()), label: MONTH_NAMES[d.getMonth()], invoices: 0, reimbursements: 0, total: 0 }
  })
  const at = new Map(series.map((p) => [p.month, p]))

  for (const i of input.invoices) {
    if (!counts(i.status)) continue
    const p = at.get(i.competence.slice(0, 7))
    if (p) p.invoices += i.amountCents
  }
  for (const r of input.reimbursements) {
    if (!counts(r.status)) continue
    const p = at.get(r.expenseDate.slice(0, 7))
    if (p) p.reimbursements += r.amountCents
  }
  for (const p of series) p.total = p.invoices + p.reimbursements

  const current = series[series.length - 1]
  const previous = series[series.length - 2] ?? { ...current, invoices: 0, reimbursements: 0, total: 0 }

  // ---- totais pagos e a pagar (em todo o histórico, não só nos 12 meses)
  const paidInvoices = input.invoices.filter((i) => i.status === "paid").reduce((t, i) => t + i.amountCents, 0)
  const paidReimbursements = input.reimbursements.filter((r) => r.status === "paid").reduce((t, r) => t + r.amountCents, 0)
  const toPay =
    input.invoices.filter((i) => i.status === "approved").reduce((t, i) => t + i.amountCents, 0) +
    input.reimbursements.filter((r) => r.status === "approved").reduce((t, r) => t + r.amountCents, 0)

  // ---- mês atual contra a média dos 3 meses completos anteriores (só reembolsos, a parte que oscila)
  const base3 = series.slice(-4, -1) // os 3 meses antes do atual
  const monthsWithData = base3.filter((p) => p.reimbursements > 0).length
  const avg3 = base3.reduce((t, p) => t + p.reimbursements, 0) / 3
  let verdict: SpendingAnalysis["reimbursementVsAvg"]["verdict"] = "sem-base"
  let pct: number | null = null
  if (monthsWithData >= 1 && avg3 > 0) {
    pct = Math.round(((current.reimbursements - avg3) / avg3) * 100)
    const diff = current.reimbursements - avg3
    verdict = current.reimbursements >= avg3 * 1.5 && diff >= 10_000 ? "acima" : current.reimbursements <= avg3 * 0.5 && avg3 >= 10_000 ? "abaixo" : "normal"
  }
  const totalPct = previous.total > 0 ? Math.round(((current.total - previous.total) / previous.total) * 100) : null

  // ---- despesas fora do padrão (últimos 90 dias)
  const valid = input.reimbursements.filter((r) => counts(r.status))
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10)
  const outliers: Outlier[] = []
  for (const r of valid) {
    if (r.expenseDate < since) continue
    const others = valid.filter((o) => o.id !== r.id)
    const sameCategory = others.filter((o) => o.category === r.category).map((o) => o.amountCents)
    const pool = sameCategory.length >= 3 ? sameCategory : others.map((o) => o.amountCents)
    if (pool.length < 3) continue // sem histórico para comparar
    const baseline = median(pool)
    if (baseline > 0 && r.amountCents >= baseline * 2 && r.amountCents - baseline >= 5_000) {
      outliers.push({ id: r.id, amountCents: r.amountCents, baselineCents: Math.round(baseline), category: r.category, expenseDate: r.expenseDate, ratio: r.amountCents / baseline })
    }
  }
  outliers.sort((a, b) => b.ratio - a.ratio)

  // ---- projeção do próximo mês
  const completed = series.slice(0, -1) // meses completos (o atual ainda está correndo)
  const recent = completed.slice(-3)
  const w = [1, 2, 3].slice(3 - recent.length) // pesos do mais antigo ao mais recente
  const wSum = w.reduce((t, x) => t + x, 0)
  const projReimb = wSum ? Math.round(recent.reduce((t, p, i) => t + p.reimbursements * w[i], 0) / wSum) : 0

  const invoiceMonths = completed.slice(-3).filter((p) => p.invoices > 0)
  const projInvoices =
    input.monthlyAgreedCents !== null
      ? input.monthlyAgreedCents
      : invoiceMonths.length
        ? Math.round(invoiceMonths.reduce((t, p) => t + p.invoices, 0) / invoiceMonths.length)
        : 0

  const history = completed.filter((p) => p.total > 0).length
  const confidence: SpendingAnalysis["projection"]["confidence"] = history >= 6 ? "alta" : history >= 3 ? "média" : "baixa"
  const note =
    history === 0 && input.monthlyAgreedCents === null
      ? "Ainda não há histórico para projetar."
      : history < 3
        ? "Pouco histórico: a projeção ainda é uma estimativa grosseira."
        : "Baseada nos últimos 3 meses completos."

  return {
    series,
    paidTotal: paidInvoices + paidReimbursements,
    paidInvoices,
    paidReimbursements,
    toPay,
    current,
    previous,
    reimbursementVsAvg: { avg: Math.round(avg3), pct, verdict },
    totalVsPrevious: { pct: totalPct },
    outliers,
    projection: { invoices: projInvoices, reimbursements: projReimb, total: projInvoices + projReimb, confidence, note },
  }
}
