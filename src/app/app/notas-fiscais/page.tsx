import type { Metadata } from "next"
import Link from "next/link"
import { and, count, desc, eq, inArray, or, sql, sum } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contracts, invoices, memberships, users } from "@/db/schema"
import { Card, Icon, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { onlyDigits } from "@/lib/cnpj"
import { formatBRL } from "@/lib/format"
import { competenceLabel, type InvoiceStatusValue } from "@/lib/invoice-status"
import { searchTerms } from "@/lib/search"
import { InvoicesTable } from "./invoices-table"
import { containsTerm } from "@/lib/search-sql"

export const metadata: Metadata = { title: "Notas fiscais" }

type Tab = "todas" | "revisao" | "aprovadas" | "pagas" | "recusadas"
const TABS: { id: Tab; label: string; statuses?: InvoiceStatusValue[] }[] = [
  { id: "todas", label: "Todas" },
  { id: "revisao", label: "Em revisão", statuses: ["submitted"] },
  { id: "aprovadas", label: "Aprovadas", statuses: ["approved"] },
  { id: "pagas", label: "Pagas", statuses: ["paid"] },
  { id: "recusadas", label: "Recusadas", statuses: ["rejected"] },
]

const href = (tab: Tab, q?: string) => {
  const params = new URLSearchParams()
  if (tab !== "todas") params.set("aba", tab)
  if (q) params.set("q", q)
  const qs = params.toString()
  return qs ? `/app/notas-fiscais?${qs}` : "/app/notas-fiscais"
}
const when = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : null)

// Todas as notas fiscais da empresa: a fila de revisão, o que falta pagar e o que já foi pago.
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const [session, params] = await Promise.all([requireSession("corporate"), searchParams])
  const tab = TABS.find((t) => t.id === params.aba) ?? TABS[0]
  const q = (params.q ?? "").slice(0, 100)

  const conditions = [eq(invoices.companyId, session.company.id)]
  if (tab.statuses) conditions.push(inArray(invoices.status, tab.statuses))

  // cada palavra precisa aparecer em algum campo (sem acento, sem diferenciar maiúsculas)
  for (const term of searchTerms(q)) {
    const digits = onlyDigits(term)
    conditions.push(
      or(
        containsTerm(invoices.number, term),
        containsTerm(users.name, term),
        containsTerm(collaborators.legalName, term),
        containsTerm(contracts.name, term),
        containsTerm(invoices.description, term),
        digits.length >= 3 ? sql`${collaborators.cnpj} like ${`%${digits}%`}` : undefined,
      )!,
    )
  }

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        amountCents: invoices.amountCents,
        competence: invoices.competence,
        status: invoices.status,
        createdAt: invoices.createdAt,
        reviewedAt: invoices.reviewedAt,
        paidAt: invoices.paidAt,
        collaborator: users.name,
        legalName: collaborators.legalName,
        contract: contracts.name,
      })
      .from(invoices)
      .innerJoin(collaborators, eq(collaborators.id, invoices.collaboratorId))
      .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(contracts, eq(contracts.id, invoices.contractId))
      .where(and(...conditions))
      // a fila de revisão mostra as mais antigas primeiro; o resto, as mais recentes
      .orderBy(tab.id === "revisao" ? invoices.createdAt : desc(invoices.createdAt)),
    // totais por situação (não dependem da busca): contadores das abas e dos indicadores
    db
      .select({ status: invoices.status, n: count(), total: sum(invoices.amountCents).mapWith(Number) })
      .from(invoices)
      .where(eq(invoices.companyId, session.company.id))
      .groupBy(invoices.status),
  ])

  const by = (s: InvoiceStatusValue) => totals.find((t) => t.status === s) ?? { n: 0, total: 0 }
  const countFor = (t: (typeof TABS)[number]) => (t.statuses ? t.statuses.reduce((n, s) => n + by(s).n, 0) : totals.reduce((n, x) => n + x.n, 0))

  return (
    <>
      <PageHeading subtitle="Todas as notas dos colaboradores: revise, aprove e marque como pagas." title="Notas fiscais" />

      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em revisão</span>
          <strong>{by("submitted").n}</strong>
          <small>{formatBRL(by("submitted").total)} aguardando decisão</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovadas, a pagar</span>
          <strong>{formatBRL(by("approved").total)}</strong>
          <small>{by("approved").n} nota(s)</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Pagas</span>
          <strong>{formatBRL(by("paid").total)}</strong>
          <small>{by("paid").n} nota(s)</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Recusadas</span>
          <strong>{by("rejected").n}</strong>
          <small>{formatBRL(by("rejected").total)}</small>
        </div>
      </div>

      <nav aria-label="Situação das notas" className="page-tabs">
        {TABS.map((t) => (
          <Link aria-current={tab.id === t.id ? "page" : undefined} href={href(t.id, q)} key={t.id}>
            {t.label}
            <span className="page-tab-count">{countFor(t)}</span>
          </Link>
        ))}
      </nav>

      <Card className="workspace-table-card">
        <div className="workspace-table-toolbar">
          <form action="/app/notas-fiscais" className="table-search" method="get" role="search">
            <Icon name="search" size={17} />
            <input aria-label="Buscar notas" defaultValue={q} name="q" placeholder="Buscar por colaborador, nº da nota, contrato ou CNPJ..." />
            {tab.id !== "todas" && <input name="aba" type="hidden" value={tab.id} />}
          </form>
        </div>

        {rows.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            {q ? `Nenhuma nota encontrada para “${q}”.` : "Nenhuma nota fiscal nesta seção."}
          </p>
        ) : (
          <InvoicesTable
            rows={rows.map((r) => ({
              id: r.id,
              number: r.number,
              collaborator: r.collaborator,
              company: r.legalName,
              contract: r.contract,
              competence: competenceLabel(r.competence),
              competenceKey: r.competence,
              amount: formatBRL(r.amountCents),
              amountCents: r.amountCents,
              status: r.status,
              sentAt: when(r.createdAt) ?? "—",
              // data da última mudança de situação: pagamento ou decisão da análise
              updatedAt: when(r.status === "paid" ? r.paidAt : r.status === "submitted" ? null : r.reviewedAt) ?? "—",
            }))}
          />
        )}
      </Card>
    </>
  )
}
