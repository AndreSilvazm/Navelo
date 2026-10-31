import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, desc, eq, ne, sql } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests, collaborators, contracts, invoices, memberships, users } from "@/db/schema"
import { Badge, Card, Icon } from "@/figma/ui"
import { BankAccountFields } from "@/components/bank-account-fields"
import { DocumentViewer } from "@/components/document-viewer"
import { getBankAccounts } from "@/lib/bank-accounts"
import { KIND_LABEL } from "@/lib/bank-labels"
import { requireSession } from "@/lib/auth/session"
import { formatCnpj } from "@/lib/cnpj"
import { formatBRL, formatDate } from "@/lib/format"
import { competenceLabel, invoiceStatusLabel, invoiceStatusTone } from "@/lib/invoice-status"
import { InvoiceActions } from "./invoice-actions"

export const metadata: Metadata = { title: "Nota fiscal" }

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

// Nota fiscal vista pelo corporativo: todos os dados, a conferência do valor com o que foi
// definido para o colaborador, o histórico (com datas) e o arquivo.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([requireSession("corporate"), params])
  if (!UUID.test(id)) notFound()

  const [row] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      amountCents: invoices.amountCents,
      competence: invoices.competence,
      description: invoices.description,
      status: invoices.status,
      fileName: invoices.fileName,
      mimeType: invoices.mimeType,
      sizeBytes: invoices.sizeBytes,
      createdAt: invoices.createdAt,
      reviewedAt: invoices.reviewedAt,
      reviewNote: invoices.reviewNote,
      paidAt: invoices.paidAt,
      reviewedBy: sql<string | null>`(select u.name from users u where u.id = ${invoices.reviewedByUserId})`,
      paidBy: sql<string | null>`(select u.name from users u where u.id = ${invoices.paidByUserId})`,
      contract: contracts.name,
      collaboratorId: collaborators.id,
      collaboratorUserId: memberships.userId,
      collaborator: users.name,
      legalName: collaborators.legalName,
      cnpj: collaborators.cnpj,
      jobTitle: collaborators.jobTitle,
      monthly: collaborators.monthlyAmountCents,
    })
    .from(invoices)
    .innerJoin(collaborators, eq(collaborators.id, invoices.collaboratorId))
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(contracts, eq(contracts.id, invoices.contractId))
    .where(and(eq(invoices.id, id), eq(invoices.companyId, session.company.id)))
  if (!row) notFound()

  // outra nota do mesmo colaborador na mesma competência (mês): vale conferir
  // contas bancárias do colaborador (para quem aprova ver para onde vai o pagamento) e pedidos de troca em análise
  const [accounts, pendingBank] = await Promise.all([
    getBankAccounts(row.collaboratorUserId),
    db
      .select({ kind: bankChangeRequests.kind })
      .from(bankChangeRequests)
      .where(and(eq(bankChangeRequests.collaboratorId, row.collaboratorId), eq(bankChangeRequests.status, "pending"))),
  ])

  const sameMonth = await db
    .select({ id: invoices.id, number: invoices.number, status: invoices.status })
    .from(invoices)
    .where(
      and(
        eq(invoices.collaboratorId, row.collaboratorId),
        ne(invoices.id, row.id),
        sql`left(${invoices.competence}::text, 7) = ${row.competence.slice(0, 7)}`,
      ),
    )
    .orderBy(desc(invoices.createdAt))

  // o valor da nota confere com o valor mensal definido para o colaborador?
  const diff = row.monthly !== null ? row.amountCents - row.monthly : null
  const check =
    row.monthly === null
      ? { tone: "neutral", title: "Valor mensal não definido", text: "Defina o valor mensal deste colaborador para conferir as notas." }
      : diff === 0
        ? { tone: "ok", title: "Confere com o valor definido", text: `A nota é de ${formatBRL(row.amountCents)}, igual ao valor mensal definido.` }
        : {
            tone: "warn",
            title: "Diferente do valor definido",
            text: `A nota é de ${formatBRL(row.amountCents)} e o valor mensal definido é ${formatBRL(row.monthly!)}: ${diff! > 0 ? "acima" : "abaixo"} em ${formatBRL(Math.abs(diff!))} (${Math.abs(Math.round((diff! / row.monthly!) * 100))}%).`,
          }

  const fileUrl = `/api/notas/${row.id}/arquivo?v=${row.createdAt.getTime()}`
  // nota da própria pessoa logada: ela não decide sobre ela
  const isSelf = row.collaboratorUserId === session.user.id
  const backHref = `/app/colaboradores/${row.collaboratorId}?aba=notas`

  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/colaboradores">Colaboradores</Link>
        <Icon name="chevron" size={13} />
        <Link href={backHref}>{row.collaborator}</Link>
        <Icon name="chevron" size={13} />
        <span>Nota nº {row.number}</span>
      </div>

      <div className="nf-detail-head">
        <div>
          <h1 className="page-title">Nota fiscal nº {row.number}</h1>
          <p className="page-subtitle">
            {row.collaborator} · competência {competenceLabel(row.competence)}
          </p>
        </div>
        <div className="nf-detail-actions">
          <Badge tone={invoiceStatusTone[row.status]}>{invoiceStatusLabel[row.status]}</Badge>
          <InvoiceActions invoiceId={row.id} isSelf={isSelf} number={row.number} status={row.status} />
        </div>
      </div>

      <div className="invoice-layout">
        <div className="invoice-main">
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Dados da nota</strong>
                <span>Como foram cadastrados pelo colaborador.</span>
              </div>
            </div>
            <dl className="info-grid">
              <Field label="Número da nota" value={row.number} />
              <Field label="Valor" value={<strong>{formatBRL(row.amountCents)}</strong>} />
              <Field label="Competência" value={`${competenceLabel(row.competence)} (${formatDate(row.competence)})`} />
              <Field label="Contrato" value={row.contract} />
              <Field label="Arquivo" value={`${row.fileName} · ${size(row.sizeBytes)}`} />
              <Field label="Enviada em" value={when(row.createdAt)} />
              <div className="info-field info-wide">
                <dt>Descrição</dt>
                <dd>{row.description || "Sem descrição"}</dd>
              </div>
            </dl>
          </Card>

          <div className={`nf-check ${check.tone}`}>
            <strong>{check.title}</strong>
            <span>{check.text}</span>
            {row.monthly === null && (
              <Link href={`/app/colaboradores/${row.collaboratorId}?aba=dashboard`}>Definir valor mensal →</Link>
            )}
          </div>

          {sameMonth.length > 0 && (
            <div className="nf-check warn">
              <strong>Outra nota na mesma competência</strong>
              <span>
                Este colaborador já tem {sameMonth.length === 1 ? "a nota" : "as notas"} nº {sameMonth.map((n) => n.number).join(", ")} em{" "}
                {competenceLabel(row.competence)}. Confira se não é duplicidade.
              </span>
            </div>
          )}

          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Dados bancários para o pagamento</strong>
                <span>A conta do colaborador, para conferir antes de aprovar e pagar.</span>
              </div>
              <Link className="doc-review-next" href={`/app/colaboradores/${row.collaboratorId}?aba=bancarios`}>
                Ver no cadastro →
              </Link>
            </div>

            {pendingBank.length > 0 && (
              <div className="nf-check warn" style={{ marginBottom: 16 }}>
                <strong>Pedido de conta bancária em análise</strong>
                <span>
                  O colaborador pediu {pendingBank.length === 1 ? "uma troca ou cadastro" : "trocas ou cadastros"} ({pendingBank.map((p) => KIND_LABEL[p.kind].toLowerCase()).join(" e ")}).
                  Decida o pedido antes de pagar, para o valor ir para a conta certa.
                </span>
                <Link href={`/app/colaboradores/${row.collaboratorId}?aba=bancarios`}>Analisar o pedido →</Link>
              </div>
            )}

            {accounts.pj || accounts.pf ? (
              <div style={{ display: "grid", gap: 20 }}>
                {accounts.pj && (
                  <section style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong>{KIND_LABEL.pj}</strong>
                      <Badge tone="success">Principal</Badge>
                    </div>
                    <BankAccountFields account={accounts.pj} holder={row.legalName} holderDoc={row.cnpj ? formatCnpj(row.cnpj) : null} holderDocLabel="CNPJ do titular" />
                  </section>
                )}
                {accounts.pf && (
                  <section style={{ display: "grid", gap: 10 }}>
                    <strong>{KIND_LABEL.pf}</strong>
                    <BankAccountFields account={accounts.pf} holder={row.collaborator} />
                  </section>
                )}
              </div>
            ) : (
              <p className="form-hint">O colaborador ainda não informou dados bancários.</p>
            )}
          </Card>

          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Colaborador</strong>
                <span>Quem enviou a nota.</span>
              </div>
            </div>
            <dl className="info-grid">
              <Field label="Nome" value={<Link href={backHref}>{row.collaborator}</Link>} />
              <Field label="Cargo" value={row.jobTitle} />
              <Field label="Razão social" value={row.legalName} />
              <Field label="CNPJ" value={row.cnpj ? formatCnpj(row.cnpj) : null} />
              <Field label="Valor mensal definido" value={row.monthly !== null ? formatBRL(row.monthly) : "Não definido"} />
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
                <strong>Enviada pelo colaborador</strong>
                <span>{when(row.createdAt)}</span>
              </li>
              {row.reviewedAt && (
                <li>
                  <strong>{row.status === "rejected" ? "Recusada" : "Aprovada"}</strong>
                  <span>
                    {when(row.reviewedAt)} · por {row.reviewedBy ?? "usuário removido"}
                  </span>
                  {row.status === "rejected" && row.reviewNote && <em>Motivo: {row.reviewNote}</em>}
                </li>
              )}
              {row.paidAt && (
                <li>
                  <strong>Paga</strong>
                  <span>
                    {when(row.paidAt)} · marcada por {row.paidBy ?? "usuário removido"}
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
                <strong>Nota fiscal</strong>
                <span>
                  {row.fileName} · <a href={`${fileUrl}&download=1`}>Baixar</a>
                </span>
              </div>
            </div>
            <div className="doc-viewer">
              <DocumentViewer fileName={row.fileName} mimeType={row.mimeType} url={fileUrl} />
            </div>
          </Card>
        </aside>
      </div>
    </>
  )
}
