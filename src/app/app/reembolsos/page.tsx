import type { Metadata } from "next"
import Link from "next/link"
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, memberships, reimbursements, users } from "@/db/schema"
import { Card, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { formatCnpj } from "@/lib/cnpj"
import { formatBRL, formatDate } from "@/lib/format"
import { categoryLabel, type ReimbursementStatus } from "@/lib/reimbursements"
import { ReimbursementsTable } from "./reimbursements-table"

export const metadata: Metadata = { title: "Reembolsos" }

type Tab = "todos" | "revisao" | "aprovados" | "pagos" | "recusados"
const TABS: { id: Tab; label: string; statuses?: ReimbursementStatus[] }[] = [
  { id: "todos", label: "Todos" },
  { id: "revisao", label: "Em revisão", statuses: ["submitted"] },
  { id: "aprovados", label: "Aprovados", statuses: ["approved"] },
  { id: "pagos", label: "Pagos", statuses: ["paid"] },
  { id: "recusados", label: "Recusados", statuses: ["rejected"] },
]

const LIMIT = 500 // pedidos mais recentes por seção; a busca da tela filtra dentro deles

// Todos os pedidos de reembolso da empresa: a fila de revisão, o que falta pagar e o que já foi pago.
export default async function ReimbursementsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const [session, params] = await Promise.all([requireSession("corporate"), searchParams])
  const tab = TABS.find((t) => t.id === params.aba) ?? TABS[0]
  const companyId = session.company.id

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: reimbursements.id,
        expenseDate: reimbursements.expenseDate,
        category: reimbursements.category,
        description: reimbursements.description,
        merchant: reimbursements.merchant,
        trip: reimbursements.trip,
        amountCents: reimbursements.amountCents,
        status: reimbursements.status,
        createdAt: reimbursements.createdAt,
        collaboratorId: collaborators.id,
        collaborator: users.name,
        legalName: collaborators.legalName,
        cnpj: collaborators.cnpj,
        receipts: sql<number>`(select count(*)::int from reimbursement_files f where f.reimbursement_id = ${reimbursements.id})`,
      })
      .from(reimbursements)
      .innerJoin(collaborators, eq(collaborators.id, reimbursements.collaboratorId))
      .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(reimbursements.companyId, companyId), tab.statuses ? inArray(reimbursements.status, tab.statuses) : undefined))
      .orderBy(desc(reimbursements.createdAt))
      .limit(LIMIT),
    db
      .select({ status: reimbursements.status, n: count(), total: sum(reimbursements.amountCents).mapWith(Number) })
      .from(reimbursements)
      .where(eq(reimbursements.companyId, companyId))
      .groupBy(reimbursements.status),
  ])

  const by = (s: ReimbursementStatus) => totals.find((t) => t.status === s) ?? { n: 0, total: 0 }
  const countFor = (t: (typeof TABS)[number]) => (t.statuses ? t.statuses.reduce((n, s) => n + by(s).n, 0) : totals.reduce((n, x) => n + x.n, 0))

  return (
    <>
      <PageHeading
        subtitle="Despesas dos colaboradores com comprovante. Analise, aprove e registre o pagamento."
        title="Reembolsos"
      />

      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em revisão</span>
          <strong>{by("submitted").n}</strong>
          <small>{formatBRL(by("submitted").total)}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovados (a pagar)</span>
          <strong>{by("approved").n}</strong>
          <small>{formatBRL(by("approved").total)}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Pagos</span>
          <strong>{by("paid").n}</strong>
          <small>{formatBRL(by("paid").total)}</small>
        </div>
      </div>

      <nav aria-label="Seções de reembolsos" className="page-tabs">
        {TABS.map((t) => (
          <Link aria-current={tab.id === t.id ? "page" : undefined} href={t.id === "todos" ? "/app/reembolsos" : `/app/reembolsos?aba=${t.id}`} key={t.id}>
            {t.label}
            <span className="page-tab-count">{countFor(t)}</span>
          </Link>
        ))}
      </nav>

      <Card className="workspace-table-card">
        {rows.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            Nenhum pedido de reembolso nesta seção.
          </p>
        ) : (
          <ReimbursementsTable
            rows={rows.map((r) => ({
              id: r.id,
              cnpj: r.cnpj ? formatCnpj(r.cnpj) : null,
              company: r.legalName,
              collaboratorId: r.collaboratorId,
              collaborator: r.collaborator,
              expenseDate: r.expenseDate,
              expenseDateLabel: formatDate(r.expenseDate),
              category: categoryLabel(r.category),
              description: r.description,
              merchant: r.merchant,
              trip: r.trip,
              amount: formatBRL(r.amountCents),
              amountCents: r.amountCents,
              status: r.status,
              receipts: r.receipts,
              sentAt: r.createdAt.toLocaleDateString("pt-BR"),
            }))}
          />
        )}
      </Card>
    </>
  )
}
