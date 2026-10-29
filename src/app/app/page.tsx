import type { Metadata } from "next"
import Link from "next/link"
import { and, count, desc, eq, gte, inArray, isNull, gt, ne, sql, sum } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests, collaborators, contracts, invitations, invoices, memberships, users } from "@/db/schema"
import { Badge, Button, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { formatBRL, formatDate } from "@/lib/format"
import { competenceLabel, invoiceStatusLabel, invoiceStatusTone } from "@/lib/invoice-status"
import { contractStatusOf } from "./contratos/status"
import { getTabCounts } from "./colaboradores/queries"

export const metadata: Metadata = { title: "Visão geral" }

const MONTHS_BACK = 6
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()))
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
}

// Visão geral da empresa: o que precisa de atenção agora, como estão os colaboradores, os contratos
// e o dinheiro das notas fiscais. Tudo calculado do que já existe na plataforma.
export default async function OverviewPage() {
  const session = await requireSession("corporate")
  const companyId = session.company.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1)
  const seriesFrom = `${key(seriesStart)}-01`

  const [counts, contractRows, byStatus, paidThisMonth, series, pendingInvites, recent, bankRequests] = await Promise.all([
    getTabCounts(companyId),
    db
      .select({
        id: contracts.id,
        name: contracts.name,
        status: contracts.status,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        people: sql<number>`(select count(*)::int from contract_collaborators cc where cc.contract_id = ${contracts.id})`,
      })
      .from(contracts)
      .where(and(eq(contracts.companyId, companyId), ne(contracts.status, "canceled")))
      .orderBy(desc(contracts.createdAt)),
    db
      .select({ status: invoices.status, n: count(), total: sum(invoices.amountCents).mapWith(Number) })
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .groupBy(invoices.status),
    db
      .select({ total: sum(invoices.amountCents).mapWith(Number) })
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.status, "paid"), gte(invoices.paidAt, monthStart))),
    // notas aprovadas e pagas por mês de competência (últimos meses)
    db
      .select({ month: sql<string>`left(${invoices.competence}::text, 7)`, status: invoices.status, total: sum(invoices.amountCents).mapWith(Number) })
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), inArray(invoices.status, ["approved", "paid"]), gte(invoices.competence, seriesFrom)))
      .groupBy(sql`left(${invoices.competence}::text, 7)`, invoices.status),
    db
      .select({ n: count() })
      .from(invitations)
      .where(and(eq(invitations.companyId, companyId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now))),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        amountCents: invoices.amountCents,
        competence: invoices.competence,
        status: invoices.status,
        collaborator: users.name,
      })
      .from(invoices)
      .innerJoin(collaborators, eq(collaborators.id, invoices.collaboratorId))
      .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.createdAt))
      .limit(5),
    // trocas de conta bancária esperando decisão
    db
      .select({ n: count(), collaboratorId: bankChangeRequests.collaboratorId })
      .from(bankChangeRequests)
      .where(and(eq(bankChangeRequests.companyId, companyId), eq(bankChangeRequests.status, "pending")))
      .groupBy(bankChangeRequests.collaboratorId),
  ])

  const inv = (s: string) => byStatus.find((x) => x.status === s) ?? { n: 0, total: 0 }
  const activeContracts = contractRows.filter((c) => contractStatusOf(c).label === "Ativo")
  const linkedPeople = activeContracts.reduce((n, c) => n + c.people, 0)
  const in30 = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const endingSoon = activeContracts.filter((c) => c.endDate && c.endDate >= today && c.endDate <= in30)

  // o que precisa da atenção da empresa (só aparece o que tem algo a fazer)
  const attention = [
    { n: counts.revisao, text: "colaborador(es) aguardando análise do cadastro", href: "/app/colaboradores?aba=revisao" },
    {
      n: bankRequests.length,
      text: "troca(s) de conta bancária esperando sua aprovação",
      href: bankRequests.length === 1 ? `/app/colaboradores/${bankRequests[0].collaboratorId}?aba=bancarios` : "/app/colaboradores?aba=ativos",
    },
    { n: inv("submitted").n, text: "nota(s) fiscal(is) em revisão", href: "/app/notas-fiscais?aba=revisao" },
    { n: inv("approved").n, text: `nota(s) aprovada(s) aguardando pagamento (${formatBRL(inv("approved").total)})`, href: "/app/notas-fiscais?aba=aprovadas" },
    { n: pendingInvites[0].n, text: "convite(s) ainda não aceito(s)", href: "/app/colaboradores?aba=convites" },
    { n: endingSoon.length, text: "contrato(s) terminando nos próximos 30 dias", href: "/app/contratos" },
  ].filter((a) => a.n > 0)

  // série dos últimos meses: pago x aprovado (a pagar), por competência
  const months = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1 - i), 1)
    const get = (s: string) => series.find((r) => r.month === key(d) && r.status === s)?.total ?? 0
    return { key: key(d), label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), paid: get("paid"), toPay: get("approved") }
  })
  const peak = Math.max(...months.map((m) => m.paid + m.toPay), 1)

  const statusRows = [
    { label: "Ativos", n: counts.ativos, href: "/app/colaboradores?aba=ativos" },
    { label: "Em revisão", n: counts.revisao, href: "/app/colaboradores?aba=revisao" },
    { label: "Em cadastro", n: counts.cadastro, href: "/app/colaboradores?aba=cadastro" },
    { label: "Suspensos", n: counts.suspensos, href: "/app/colaboradores?aba=suspensos" },
    { label: "Recusados", n: counts.recusados, href: "/app/colaboradores?aba=recusados" },
  ]

  return (
    <>
      <PageHeading
        action={
          <Button href="/app/contratos/novo" icon="plus">
            Novo contrato
          </Button>
        }
        subtitle={`Resumo de ${session.company.tradeName ?? session.company.legalName}.`}
        title={`${greeting()}, ${session.user.name.split(" ")[0]}`}
      />

      <div className="dash">
        <div className="dash-kpis">
          <Link className="dash-kpi kpi-link" href="/app/colaboradores?aba=ativos">
            <span className="dash-kpi-label">Colaboradores ativos</span>
            <strong>{counts.ativos}</strong>
            <small>
              {counts.cadastro} em cadastro · {counts.revisao} em análise
            </small>
          </Link>
          <Link className="dash-kpi kpi-link" href="/app/contratos">
            <span className="dash-kpi-label">Contratos ativos</span>
            <strong>{activeContracts.length}</strong>
            <small>{linkedPeople} vínculo(s) de colaboradores</small>
          </Link>
          <Link className="dash-kpi kpi-link" href="/app/notas-fiscais?aba=aprovadas">
            <span className="dash-kpi-label">A pagar (notas aprovadas)</span>
            <strong>{formatBRL(inv("approved").total)}</strong>
            <small>
              {inv("approved").n} nota(s) · {inv("submitted").n} em revisão
            </small>
          </Link>
          <Link className="dash-kpi kpi-link" href="/app/notas-fiscais?aba=pagas">
            <span className="dash-kpi-label">Pago no mês</span>
            <strong>{formatBRL(paidThisMonth[0]?.total ?? 0)}</strong>
            <small>{formatBRL(inv("paid").total)} no total</small>
          </Link>
        </div>

        <div className="dash-grid">
          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Precisa da sua atenção</strong>
                <span>O que está esperando uma decisão ou uma ação sua</span>
              </div>
            </div>
            {attention.length === 0 ? (
              <p className="all-clear">Tudo em dia. Nada esperando por você agora.</p>
            ) : (
              <ul className="attn-list">
                {attention.map((a) => (
                  <li key={a.href + a.text}>
                    <Link href={a.href}>
                      <b>{a.n}</b>
                      <span>{a.text}</span>
                      <i aria-hidden="true">→</i>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Colaboradores por situação</strong>
                <span>{counts.todos} no total</span>
              </div>
            </div>
            <ul className="status-bars">
              {statusRows.map((r) => (
                <li key={r.label}>
                  <Link href={r.href}>
                    <span>{r.label}</span>
                    <div className="status-bar">
                      <i style={{ width: `${counts.todos ? (r.n / counts.todos) * 100 : 0}%` }} />
                    </div>
                    <b>{r.n}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="dash-grid">
          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Notas por mês de competência</strong>
                <span>Últimos {MONTHS_BACK} meses: o que já foi pago e o que está aprovado, a pagar</span>
              </div>
              <span className="dash-legend">
                <i className="paid" /> Pago
              </span>
              <span className="dash-legend">
                <i /> A pagar
              </span>
            </div>
            {months.every((m) => m.paid + m.toPay === 0) ? (
              <p className="form-hint" style={{ padding: "28px 0" }}>
                Ainda não há notas aprovadas ou pagas nesse período.
              </p>
            ) : (
              <div className="mo-chart" role="img" aria-label="Notas aprovadas e pagas por mês">
                {months.map((m) => (
                  <div className="mo-col" key={m.key} title={`${m.label}: pago ${formatBRL(m.paid)} · a pagar ${formatBRL(m.toPay)}`}>
                    <div className="mo-stack">
                      <i className="to-pay" style={{ height: `${(m.toPay / peak) * 100}%` }} />
                      <i className="paid" style={{ height: `${(m.paid / peak) * 100}%` }} />
                    </div>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Últimas notas</strong>
                <span>As cinco mais recentes</span>
              </div>
              <Link className="doc-review-next" href="/app/notas-fiscais">
                Ver todas →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="form-hint">Nenhuma nota enviada ainda.</p>
            ) : (
              <ul className="dash-contracts">
                {recent.map((r) => (
                  <li key={r.id}>
                    <div>
                      <Link href={`/app/notas-fiscais/${r.id}`}>
                        nº {r.number} · {r.collaborator}
                      </Link>
                      <small>
                        {competenceLabel(r.competence)} · {formatBRL(r.amountCents)}
                      </small>
                    </div>
                    <Badge tone={invoiceStatusTone[r.status]}>{invoiceStatusLabel[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <strong>Contratos</strong>
              <span>{activeContracts.length} ativo(s)</span>
            </div>
            <Link className="doc-review-next" href="/app/contratos">
              Ver todos →
            </Link>
          </div>
          {contractRows.length === 0 ? (
            <p className="form-hint">Nenhum contrato ainda. Crie o primeiro para vincular colaboradores.</p>
          ) : (
            <ul className="dash-contracts">
              {contractRows.slice(0, 5).map((c) => {
                const status = contractStatusOf(c)
                return (
                  <li key={c.id}>
                    <div>
                      <Link href={`/app/contratos/${c.id}`}>{c.name}</Link>
                      <small>
                        {formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : "sem prazo final"} · {c.people} colaborador(es)
                      </small>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
