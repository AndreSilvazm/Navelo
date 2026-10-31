import type { Metadata } from "next"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { reimbursements } from "@/db/schema"
import { Button, Card, PageHeading } from "@/figma/ui"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { formatBRL, formatDate } from "@/lib/format"
import { categoryLabel } from "@/lib/reimbursements"
import { PortalReimbursementsTable } from "./portal-reimbursements-table"

export const metadata: Metadata = { title: "Meus reembolsos" }

export default async function PortalReimbursementsPage() {
  const { collaborator } = await requireActiveCollaborator()

  const rows = await db
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
      receipts: sql<number>`(select count(*)::int from reimbursement_files f where f.reimbursement_id = ${reimbursements.id})`,
    })
    .from(reimbursements)
    .where(eq(reimbursements.collaboratorId, collaborator.id))
    .orderBy(desc(reimbursements.expenseDate), desc(reimbursements.createdAt))

  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((t, r) => t + r.amountCents, 0)
  const count = (s: string) => rows.filter((r) => r.status === s).length

  return (
    <>
      <PageHeading
        action={
          <Button href="/portal/reembolsos/novo" icon="plus">
            Pedir reembolso
          </Button>
        }
        subtitle="Despesas que você teve a serviço da empresa. Anexe os comprovantes e acompanhe a análise e o pagamento."
        title="Meus reembolsos"
      />

      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em revisão</span>
          <strong>{count("submitted")}</strong>
          <small>{formatBRL(sum("submitted"))}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovados (a receber)</span>
          <strong>{count("approved")}</strong>
          <small>{formatBRL(sum("approved"))}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Pagos</span>
          <strong>{count("paid")}</strong>
          <small>{formatBRL(sum("paid"))}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Recusados</span>
          <strong>{count("rejected")}</strong>
          <small>{formatBRL(sum("rejected"))}</small>
        </div>
      </div>

      <Card className="workspace-table-card">
        {rows.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            Você ainda não pediu nenhum reembolso. Teve uma despesa a serviço da empresa? Peça acima e anexe o comprovante.
          </p>
        ) : (
          <PortalReimbursementsTable
            rows={rows.map((r) => ({
              id: r.id,
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
