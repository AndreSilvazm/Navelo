import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contracts, memberships, reimbursementFiles, reimbursements, users } from "@/db/schema"
import { Badge, Card, Icon } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { formatCnpj } from "@/lib/cnpj"
import { formatBRL, formatDate } from "@/lib/format"
import { categoryLabel, reimbursementStatusLabel, reimbursementStatusTone } from "@/lib/reimbursements"
import { ReceiptsViewer } from "./receipts-viewer"
import { ReimbursementActions } from "./reimbursement-actions"

export const metadata: Metadata = { title: "Reembolso" }

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

// Pedido de reembolso visto pelo corporativo: dados, comprovantes, histórico e as decisões.
export default async function ReimbursementPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([requireSession("corporate"), params])
  if (!UUID.test(id)) notFound()

  const [row] = await db
    .select({
      r: reimbursements,
      collaborator: users.name,
      collaboratorUserId: memberships.userId,
      legalName: collaborators.legalName,
      cnpj: collaborators.cnpj,
      jobTitle: collaborators.jobTitle,
      contract: contracts.name,
      reviewedBy: sql<string | null>`(select u.name from users u where u.id = ${reimbursements.reviewedByUserId})`,
      paidBy: sql<string | null>`(select u.name from users u where u.id = ${reimbursements.paidByUserId})`,
    })
    .from(reimbursements)
    .innerJoin(collaborators, eq(collaborators.id, reimbursements.collaboratorId))
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(contracts, eq(contracts.id, reimbursements.contractId))
    .where(and(eq(reimbursements.id, id), eq(reimbursements.companyId, session.company.id)))
  if (!row) notFound()
  const { r } = row

  const [files, twins] = await Promise.all([
    db.select().from(reimbursementFiles).where(eq(reimbursementFiles.reimbursementId, id)).orderBy(asc(reimbursementFiles.createdAt)),
    // outro pedido do mesmo colaborador, no mesmo dia e com o mesmo valor: vale conferir se é duplicidade
    db
      .select({ id: reimbursements.id, status: reimbursements.status })
      .from(reimbursements)
      .where(
        and(
          eq(reimbursements.collaboratorId, r.collaboratorId),
          ne(reimbursements.id, id),
          eq(reimbursements.expenseDate, r.expenseDate),
          eq(reimbursements.amountCents, r.amountCents),
          inArray(reimbursements.status, ["submitted", "approved", "paid"]),
        ),
      ),
  ])

  const isSelf = row.collaboratorUserId === session.user.id
  const backHref = `/app/colaboradores/${r.collaboratorId}?aba=dashboard`

  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/reembolsos">Reembolsos</Link>
        <Icon name="chevron" size={13} />
        <Link href={backHref}>{row.collaborator}</Link>
        <Icon name="chevron" size={13} />
        <span>{categoryLabel(r.category)}</span>
      </div>

      <div className="nf-detail-head">
        <div>
          <h1 className="page-title">{formatBRL(r.amountCents)}</h1>
          <p className="page-subtitle">
            {row.collaborator} · {categoryLabel(r.category)} · {formatDate(r.expenseDate)}
          </p>
        </div>
        <div className="nf-detail-actions">
          <Badge tone={reimbursementStatusTone[r.status]}>{reimbursementStatusLabel[r.status]}</Badge>
          <ReimbursementActions id={r.id} isSelf={isSelf} status={r.status} />
        </div>
      </div>

      <div className="invoice-layout">
        <div className="invoice-main">
          {twins.length > 0 && (
            <div className="nf-check warn">
              <strong>Possível duplicidade</strong>
              <span>
                Este colaborador tem outro pedido de {formatBRL(r.amountCents)} na mesma data ({formatDate(r.expenseDate)}):{" "}
                {twins.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ", "}
                    <Link href={`/app/reembolsos/${t.id}`}>ver pedido</Link>
                  </span>
                ))}
                . Confira se não é a mesma despesa enviada duas vezes.
              </span>
            </div>
          )}

          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Dados da despesa</strong>
                <span>Como foram informados pelo colaborador.</span>
              </div>
            </div>
            <dl className="info-grid">
              <Field label="Categoria" value={categoryLabel(r.category)} />
              <Field label="Valor" value={<strong>{formatBRL(r.amountCents)}</strong>} />
              <Field label="Data da despesa" value={formatDate(r.expenseDate)} />
              <Field label="Estabelecimento" value={r.merchant} />
              <Field label="Viagem ou projeto" value={r.trip} />
              <Field label="Contrato" value={row.contract} />
              <Field label="Enviado em" value={when(r.createdAt)} />
              <Field label="Comprovantes" value={`${files.length} arquivo(s)`} />
              <div className="info-field info-wide">
                <dt>Descrição</dt>
                <dd>{r.description}</dd>
              </div>
            </dl>
          </Card>

          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Colaborador</strong>
                <span>Quem pediu o reembolso.</span>
              </div>
            </div>
            <dl className="info-grid">
              <Field label="Nome" value={<Link href={backHref}>{row.collaborator}</Link>} />
              <Field label="Cargo" value={row.jobTitle} />
              <Field label="Razão social" value={row.legalName} />
              <Field label="CNPJ" value={row.cnpj ? formatCnpj(row.cnpj) : null} />
            </dl>
          </Card>

          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Histórico</strong>
                <span>Cada etapa fica registrada com a data e quem fez.</span>
              </div>
            </div>
            <ol className="nf-history">
              <li>
                <strong>Pedido enviado pelo colaborador</strong>
                <span>{when(r.createdAt)}</span>
              </li>
              {r.reviewedAt && (
                <li>
                  <strong>{r.status === "rejected" ? "Recusado" : "Aprovado"}</strong>
                  <span>
                    {when(r.reviewedAt)} · por {row.reviewedBy ?? "usuário removido"}
                  </span>
                  {r.status === "rejected" && r.reviewNote && <em>Motivo: {r.reviewNote}</em>}
                </li>
              )}
              {r.paidAt && (
                <li>
                  <strong>Pago</strong>
                  <span>
                    {when(r.paidAt)} · marcado por {row.paidBy ?? "usuário removido"}
                  </span>
                </li>
              )}
            </ol>
          </Card>
        </div>

        <aside className="invoice-preview">
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Comprovantes</strong>
                <span>Anexados pelo colaborador.</span>
              </div>
            </div>
            <ReceiptsViewer
              receipts={files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, size: size(f.sizeBytes) }))}
              reimbursementId={id}
              version={r.createdAt.getTime()}
            />
          </Card>
        </aside>
      </div>
    </>
  )
}
