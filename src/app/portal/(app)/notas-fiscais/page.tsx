import type { Metadata } from "next"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { contracts, invoices } from "@/db/schema"
import { Badge, Button, Card, PageHeading } from "@/figma/ui"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { formatBRL } from "@/lib/format"
import { competenceLabel, invoiceStatusLabel, invoiceStatusTone } from "@/lib/invoice-status"

export const metadata: Metadata = { title: "Minhas notas fiscais" }

export default async function PortalInvoicesPage() {
  const { collaborator } = await requireActiveCollaborator()

  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      amountCents: invoices.amountCents,
      competence: invoices.competence,
      description: invoices.description,
      status: invoices.status,
      reviewNote: invoices.reviewNote,
      reviewedAt: invoices.reviewedAt,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
      contract: contracts.name,
    })
    .from(invoices)
    .leftJoin(contracts, eq(contracts.id, invoices.contractId))
    .where(eq(invoices.collaboratorId, collaborator.id))
    .orderBy(desc(invoices.competence), desc(invoices.createdAt))

  const sum = (status: string) => rows.filter((r) => r.status === status).reduce((t, r) => t + r.amountCents, 0)
  const count = (status: string) => rows.filter((r) => r.status === status).length

  return (
    <>
      <PageHeading
        action={
          <Button href="/portal/notas-fiscais/enviar" icon="plus">
            Enviar nota fiscal
          </Button>
        }
        subtitle="Cadastre suas notas e acompanhe a aprovação e o pagamento."
        title="Minhas notas fiscais"
      />

      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em revisão</span>
          <strong>{count("submitted")}</strong>
          <small>{formatBRL(sum("submitted"))}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovadas (a pagar)</span>
          <strong>{count("approved")}</strong>
          <small>{formatBRL(sum("approved"))}</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Pagas</span>
          <strong>{count("paid")}</strong>
          <small>{formatBRL(sum("paid"))}</small>
        </div>
      </div>

      <Card className="workspace-table-card">
        {rows.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            Você ainda não enviou nenhuma nota fiscal.
          </p>
        ) : (
          <div className="workspace-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Nota</th>
                  <th>Contrato</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th>Enviada em</th>
                  <th>Atualizada em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{competenceLabel(r.competence)}</td>
                    <td>
                      <strong style={{ whiteSpace: "nowrap" }}>nº {r.number}</strong>
                      {r.description && <div className="form-hint">{r.description}</div>}
                      {r.status === "rejected" && r.reviewNote && <div className="form-hint">Motivo da recusa: {r.reviewNote}</div>}
                    </td>
                    <td>{r.contract ?? "—"}</td>
                    <td>{formatBRL(r.amountCents)}</td>
                    <td>
                      <Badge tone={invoiceStatusTone[r.status]}>{invoiceStatusLabel[r.status]}</Badge>
                    </td>
                    <td>{r.createdAt.toLocaleDateString("pt-BR")}</td>
                    {/* data da última mudança de situação: pagamento ou decisão da análise */}
                    <td>{(r.status === "paid" ? r.paidAt : r.status === "submitted" ? null : r.reviewedAt)?.toLocaleDateString("pt-BR") ?? "—"}</td>
                    <td>
                      <a className="doc-review-next" href={`/api/notas/${r.id}/arquivo`} rel="noreferrer" target="_blank">
                        Ver nota
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
