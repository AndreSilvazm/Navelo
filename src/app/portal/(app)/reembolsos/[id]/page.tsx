import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { reimbursementFiles, reimbursements } from "@/db/schema"
import { Badge, Card, Icon } from "@/figma/ui"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { formatBRL, formatDate } from "@/lib/format"
import { categoryLabel, reimbursementStatusLabel, reimbursementStatusTone } from "@/lib/reimbursements"

export const metadata: Metadata = { title: "Pedido de reembolso" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const when = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null)
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-field">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

// O pedido como o colaborador vê: dados, situação, motivo da recusa (se houver) e os comprovantes
export default async function PortalReimbursementPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ collaborator }, { id }] = await Promise.all([requireActiveCollaborator(), params])
  if (!UUID.test(id)) notFound()

  const [row] = await db
    .select()
    .from(reimbursements)
    .where(and(eq(reimbursements.id, id), eq(reimbursements.collaboratorId, collaborator.id)))
  if (!row) notFound()

  const files = await db.select().from(reimbursementFiles).where(eq(reimbursementFiles.reimbursementId, id)).orderBy(asc(reimbursementFiles.createdAt))

  return (
    <>
      <div className="breadcrumb">
        <Link href="/portal/reembolsos">Meus reembolsos</Link>
        <Icon name="chevron" size={13} />
        <span>{categoryLabel(row.category)}</span>
      </div>

      <div className="nf-detail-head">
        <div>
          <h1 className="page-title">{formatBRL(row.amountCents)}</h1>
          <p className="page-subtitle">
            {categoryLabel(row.category)} · {formatDate(row.expenseDate)}
          </p>
        </div>
        <div className="nf-detail-actions">
          <Badge tone={reimbursementStatusTone[row.status]}>{reimbursementStatusLabel[row.status]}</Badge>
        </div>
      </div>

      {row.status === "rejected" && row.reviewNote && (
        <div className="nf-check warn" style={{ marginBottom: 16 }}>
          <strong>Pedido recusado</strong>
          <span>Motivo: {row.reviewNote}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 24, maxWidth: 820 }}>
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Dados da despesa</strong>
              <span>Como você informou.</span>
            </div>
          </div>
          <dl className="info-grid">
            <Field label="Categoria" value={categoryLabel(row.category)} />
            <Field label="Valor" value={<strong>{formatBRL(row.amountCents)}</strong>} />
            <Field label="Data da despesa" value={formatDate(row.expenseDate)} />
            <Field label="Estabelecimento" value={row.merchant} />
            <Field label="Viagem ou projeto" value={row.trip} />
            <Field label="Enviado em" value={when(row.createdAt)} />
            <div className="info-field info-wide">
              <dt>Descrição</dt>
              <dd>{row.description}</dd>
            </div>
          </dl>
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Comprovantes</strong>
              <span>{files.length} arquivo(s) anexado(s).</span>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <a href={`/api/reembolsos/${id}/arquivos/${f.id}`} rel="noreferrer" target="_blank">
                  <strong>{f.fileName}</strong> <span className="form-hint">{size(f.sizeBytes)}</span>
                </a>
                <a className="doc-review-next" href={`/api/reembolsos/${id}/arquivos/${f.id}?download=1`}>
                  Baixar
                </a>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Andamento</strong>
              <span>Cada etapa fica registrada com a data.</span>
            </div>
          </div>
          <ol className="nf-history">
            <li>
              <strong>Pedido enviado</strong>
              <span>{when(row.createdAt)}</span>
            </li>
            {row.reviewedAt && (
              <li>
                <strong>{row.status === "rejected" ? "Recusado" : "Aprovado"}</strong>
                <span>{when(row.reviewedAt)}</span>
                {row.status === "rejected" && row.reviewNote && <em>Motivo: {row.reviewNote}</em>}
              </li>
            )}
            {row.paidAt && (
              <li>
                <strong>Pago</strong>
                <span>{when(row.paidAt)}</span>
              </li>
            )}
          </ol>
        </Card>
      </div>
    </>
  )
}
