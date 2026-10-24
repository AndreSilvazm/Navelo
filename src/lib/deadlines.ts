// Avisos de prazo de envio das notas fiscais. Cálculo puro (sem banco): recebe os contratos do
// colaborador, as notas dele e a data de hoje.
//
// Regra: o contrato define "até o dia N de cada mês". A nota de cada mês de competência é
// entregue até o dia N do mês seguinte (trabalho de outubro -> nota até o dia N de novembro).
// Em meses mais curtos vale o último dia. Nota recusada não conta como enviada.

export type DeadlineContract = {
  id: string
  name: string
  startDate: string // AAAA-MM-DD
  endDate: string | null
  invoiceDueDay: number | null
  linkedAt: string // AAAA-MM-DD: quando o colaborador entrou no contrato
}

export type DeadlineInvoice = { contractId: string | null; competence: string; status: string }

export type DeadlineAlert = {
  id: string
  contractId: string
  level: "danger" | "warning"
  title: string
  body: string
  /** prazo (AAAA-MM-DD) e dias que faltam (negativo = atrasada) */
  dueDate: string
  daysLeft: number
}

/** quantos dias antes do prazo o aviso começa */
export const WARN_DAYS = 5

const pad = (n: number) => String(n).padStart(2, "0")
const monthLabel = (key: string) => `${key.slice(5, 7)}/${key.slice(0, 4)}` // "2026-09" -> "09/2026"
const dateLabel = (iso: string) => iso.split("-").reverse().join("/")
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

export function computeDeadlineAlerts(contracts: DeadlineContract[], invoices: DeadlineInvoice[], today: string): DeadlineAlert[] {
  const alerts: DeadlineAlert[] = []
  const year = +today.slice(0, 4)
  const month = +today.slice(5, 7) // 1..12

  for (const c of contracts) {
    if (!c.invoiceDueDay) continue

    // ciclo deste mês (nota do mês passado) e do próximo (nota deste mês)
    for (const offset of [0, 1]) {
      const due = new Date(Date.UTC(year, month - 1 + offset, 1)) // primeiro dia do mês do prazo
      const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate()
      const dueDate = `${due.getUTCFullYear()}-${pad(due.getUTCMonth() + 1)}-${pad(Math.min(c.invoiceDueDay, lastDay))}`

      const comp = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() - 1, 1)) // mês de competência
      const compKey = `${comp.getUTCFullYear()}-${pad(comp.getUTCMonth() + 1)}`

      // não cobra nota de mês anterior ao contrato/vínculo nem depois do fim do contrato
      if (compKey < c.startDate.slice(0, 7) || compKey < c.linkedAt.slice(0, 7)) continue
      if (c.endDate && compKey > c.endDate.slice(0, 7)) continue

      const sent = invoices.some((i) => i.contractId === c.id && i.competence.slice(0, 7) === compKey && i.status !== "rejected")
      if (sent) continue

      const daysLeft = Math.round((utc(dueDate) - utc(today)) / 86_400_000)
      const id = `deadline:${c.id}:${compKey}`

      if (daysLeft < 0) {
        // atrasada: só o ciclo corrente (os mais antigos não ficam acumulando)
        if (offset === 0)
          alerts.push({
            id,
            contractId: c.id,
            level: "danger",
            title: `Nota de ${monthLabel(compKey)} em atraso`,
            body: `O prazo do contrato ${c.name} era ${dateLabel(dueDate)}. Envie a nota o quanto antes.`,
            dueDate,
            daysLeft,
          })
      } else if (daysLeft <= WARN_DAYS) {
        alerts.push({
          id,
          contractId: c.id,
          level: "warning",
          title: daysLeft === 0 ? "O prazo para enviar a nota vence hoje" : `Prazo para enviar a nota: ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`,
          body: `Envie a nota de ${monthLabel(compKey)} do contrato ${c.name} até ${dateLabel(dueDate)}.`,
          dueDate,
          daysLeft,
        })
      }
    }
  }

  // mais urgente primeiro
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
}
