import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/db"
import { collaborators, contractFiles, contractRequirements, contracts, invoices, memberships, users } from "@/db/schema"
import { Badge, Button, Card, Icon } from "@/figma/ui"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { CORPORATE_ROLES, requireSession } from "@/lib/auth/session"

import { formatBRL, formatDate, formatInvoiceDue } from "@/lib/format"
import { statusLabel, statusTone } from "../../colaboradores/types"
import { deleteContractFile, removeContractRequirement } from "../actions"
import { collaboratorOption } from "../options"
import { contractStatusOf } from "../status"
import { EditContractForm } from "./edit-form"
import { EndContractButton } from "./end-contract-button"
import { ContractFileForm } from "./file-form"
import { RequirementForm } from "./requirement-form"

export const metadata: Metadata = { title: "Contrato" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TABS = [
  { id: "geral", label: "Visão geral" },
  { id: "arquivos", label: "Arquivos" },
  { id: "documentos", label: "Exigências" },
  { id: "notas", label: "Notas fiscais" },
  { id: "dados", label: "Dados do contrato" },
] as const
type TabId = (typeof TABS)[number]["id"]

const DAY = 86_400_000
const days = (from: string, to: number) => Math.floor((to - new Date(from).getTime()) / DAY)
const rowStyle = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" } as const
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const when = (d: Date) => d.toLocaleDateString("pt-BR")

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong style={muted ? { color: "var(--zn-gray-2)", fontWeight: 500 } : undefined}>{value}</strong>
    </div>
  )
}

// "12 dias", "5 meses", "2 anos"
function durationLabel(d: number) {
  if (d < 1) return "menos de 1 dia"
  if (d < 60) return `${d} ${d === 1 ? "dia" : "dias"}`
  if (d < 730) return `${Math.floor(d / 30)} meses`
  return `${Math.floor(d / 365)} anos`
}

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const [session, { id }, { aba }] = await Promise.all([requireSession("corporate"), params, searchParams])
  if (!UUID.test(id)) notFound()
  const tab: TabId = TABS.find((t) => t.id === aba)?.id ?? "geral"

  // contrato, colaborador, exigências e arquivos, tudo em paralelo (uma ida ao banco)
  const ownerUser = alias(users, "owner_user")
  const [[contract], docs, files, members, invoiceRows] = await Promise.all([
    db
      .select({
        c: contracts,
        responsible: users.name,
        ownerName: ownerUser.name,
        person: {
          id: collaborators.id,
          status: collaborators.status,
          legalName: collaborators.legalName,
          cnpj: collaborators.cnpj,
          jobTitle: collaborators.jobTitle,
        },
      })
      .from(contracts)
      .leftJoin(users, eq(users.id, contracts.responsibleUserId))
      .leftJoin(collaborators, eq(collaborators.id, contracts.collaboratorId))
      .leftJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .leftJoin(ownerUser, eq(ownerUser.id, memberships.userId))
      .where(and(eq(contracts.id, id), eq(contracts.companyId, session.company.id))),
    db.select().from(contractRequirements).where(eq(contractRequirements.contractId, id)).orderBy(asc(contractRequirements.createdAt)),
    db
      .select({
        id: contractFiles.id,
        title: contractFiles.title,
        fileName: contractFiles.fileName,
        mimeType: contractFiles.mimeType,
        sizeBytes: contractFiles.sizeBytes,
        createdAt: contractFiles.createdAt,
        by: users.name,
      })
      .from(contractFiles)
      .leftJoin(users, eq(users.id, contractFiles.uploadedByUserId))
      .where(eq(contractFiles.contractId, id))
      .orderBy(desc(contractFiles.createdAt)),
    // equipe corporativa (para escolher o responsável ao editar)
    tab === "dados"
      ? db
          .select({ id: users.id, name: users.name, role: memberships.role })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(and(eq(memberships.companyId, session.company.id), eq(memberships.status, "active"), inArray(memberships.role, [...CORPORATE_ROLES])))
          .orderBy(asc(users.name))
      : Promise.resolve([]),
    tab === "notas"
      ? db
          .select({ id: invoices.id, number: invoices.number, amountCents: invoices.amountCents, competence: invoices.competence, status: invoices.status })
          .from(invoices)
          .where(and(eq(invoices.contractId, id), eq(invoices.companyId, session.company.id)))
          .orderBy(desc(invoices.competence))
      : Promise.resolve([]),
  ])
  if (!contract) notFound()

  const { c, person } = contract
  const owner = contract.ownerName ? { name: contract.ownerName } : undefined
  const status = contractStatusOf(c)
  const canEdit = c.status !== "canceled"
  const now = new Date().getTime()
  const href = (t: TabId) => (t === "geral" ? `/app/contratos/${id}` : `/app/contratos/${id}?aba=${t}`)
  const counts: Partial<Record<TabId, number>> = { arquivos: files.length, documentos: docs.length }
  const requiredDocs = docs.filter((d) => d.required).length

  // vigência em linguagem simples
  const sinceDays = days(c.startDate, now)
  const validity = sinceDays < 0 ? `Começa em ${formatDate(c.startDate)}` : `Em vigor há ${durationLabel(sinceDays)}`
  const end = c.endDate
    ? `Termina em ${formatDate(c.endDate)}${days(c.endDate, now) < 0 ? ` (faltam ${-days(c.endDate, now)} dias)` : ""}`
    : "Sem prazo final: segue vigente até ser encerrado"

  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/contratos">Contratos</Link>
        <Icon name="chevron" size={13} />
        <span>{c.name}</span>
      </div>

      <Card className="mvp-contract-hero">
        <span className="contract-main-icon">
          <Icon name="contract" size={23} />
        </span>
        <div>
          <span>{owner?.name ?? "Sem colaborador"}</span>
          <strong>{c.name}</strong>
          <small>{c.description ?? "—"}</small>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Badge tone={status.tone}>{status.label}</Badge>
          {c.status === "active" && <EndContractButton contractId={id} />}
        </div>
      </Card>

      <nav aria-label="Seções do contrato" className="page-tabs" style={{ marginTop: 24 }}>
        {TABS.map((t) => (
          <Link aria-current={tab === t.id ? "page" : undefined} href={href(t.id)} key={t.id}>
            {t.label}
            {counts[t.id] !== undefined && <span className="page-tab-count">{counts[t.id]}</span>}
          </Link>
        ))}
      </nav>

      {tab === "geral" && (
        <>
          <div className="mvp-contract-facts" style={{ marginTop: 0 }}>
            <Fact label="Colaborador" muted={!owner} value={owner?.name ?? "Sem colaborador"} />
            <Fact label="Período" value={`${formatDate(c.startDate)} — ${c.endDate ? formatDate(c.endDate) : "Sem prazo final"}`} />
            <Fact label="Valor" muted={c.amountCents === null} value={c.amountCents !== null ? formatBRL(c.amountCents) : "A definir"} />
            <Fact label="Envio das notas fiscais" value={formatInvoiceDue(c.invoiceDueDay)} />
            <Fact label="Responsável" value={contract.responsible ?? "Sem responsável"} />
          </div>

          <div className="mvp-settings-grid" style={{ marginTop: 24 }}>
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Vigência</strong>
                  <span>{validity}</span>
                </div>
              </div>
              <p className="form-hint" style={{ margin: 0 }}>
                {end}.
              </p>
              {c.amountCents === null && (
                <p className="form-hint" style={{ marginTop: 8 }}>
                  O valor ainda está a definir. Informe em <Link href={href("dados")}>Dados do contrato</Link> quando souber.
                </p>
              )}
            </Card>

            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Colaborador</strong>
                  <span>Dono deste contrato</span>
                </div>
              </div>
              {person?.id && owner ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <Link href={`/app/colaboradores/${person.id}`}>
                    <strong>{owner.name}</strong>
                  </Link>
                  <span className="form-hint">{collaboratorOption({ id: person.id, name: owner.name, legalName: person.legalName, cnpj: person.cnpj, jobTitle: person.jobTitle }).hint}</span>
                  {person.status && <Badge tone={statusTone[person.status]}>{statusLabel[person.status]}</Badge>}
                </div>
              ) : (
                <p className="form-hint">Este contrato antigo não tem colaborador. Crie um contrato novo para a pessoa certa.</p>
              )}
            </Card>
          </div>

          <div className="mvp-settings-grid" style={{ marginTop: 24 }}>
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Arquivos do contrato</strong>
                  <span>{files.length === 0 ? "Nenhum arquivo anexado ainda." : `${files.length} arquivo(s) anexado(s).`}</span>
                </div>
                <Link className="doc-review-next" href={href("arquivos")}>
                  Gerenciar →
                </Link>
              </div>
            </Card>
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Exigências deste contrato</strong>
                  <span>{docs.length === 0 ? "Nenhuma exigência específica." : `${docs.length} exigido(s), ${requiredDocs} obrigatório(s).`}</span>
                </div>
                <Link className="doc-review-next" href={href("documentos")}>
                  Gerenciar →
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "arquivos" && (
        <div className="mvp-settings-grid">
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Arquivos anexados</strong>
                <span>Documentos deste contrato. Só o corporativo vê e anexa.</span>
              </div>
            </div>
            {files.length === 0 ? (
              <p className="form-hint">Nenhum arquivo anexado ainda.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {files.map((f) => (
                  <div key={f.id} style={rowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <a href={`/api/contratos/${id}/arquivos/${f.id}`} rel="noreferrer" target="_blank">
                        <strong>{f.title}</strong>
                      </a>
                      <div className="form-hint">
                        {f.fileName} · {size(f.sizeBytes)} · anexado em {when(f.createdAt)} por {f.by ?? "usuário removido"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <a className="doc-review-next" href={`/api/contratos/${id}/arquivos/${f.id}?download=1`}>
                        Baixar
                      </a>
                      {canEdit && (
                        <form action={deleteContractFile.bind(null, id, f.id)}>
                          <Button type="submit" variant="ghost">
                            Remover
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {canEdit && (
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Anexar documento</strong>
                  <span>Contrato assinado, aditivos e outros documentos deste contrato.</span>
                </div>
              </div>
              <ContractFileForm contractId={id} />
            </Card>
          )}
        </div>
      )}

      {tab === "documentos" && (
        <div className="mvp-settings-grid">
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Documentos que o colaborador precisa entregar</strong>
                <span>Exigidos além dos documentos de cadastro da empresa.</span>
              </div>
            </div>
            {docs.length === 0 ? (
              <p className="form-hint">Nenhuma exigência específica.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {docs.map((d) => (
                  <div key={d.id} style={rowStyle}>
                    <strong>{d.name}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge tone={d.required ? "warning" : "neutral"}>{d.required ? "Obrigatório" : "Opcional"}</Badge>
                      {canEdit && (
                        <form action={removeContractRequirement.bind(null, id, d.id)}>
                          <Button type="submit" variant="ghost">
                            Remover
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {canEdit && (
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Adicionar exigência</strong>
                  <span>Documento pedido só neste contrato.</span>
                </div>
              </div>
              <RequirementForm contractId={id} />
            </Card>
          )}
        </div>
      )}

      {tab === "notas" && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Notas fiscais</strong>
              <span>Prazo de envio: {formatInvoiceDue(c.invoiceDueDay)}.</span>
            </div>
          </div>
          {invoiceRows.length === 0 ? (
            <p className="form-hint">O colaborador ainda não enviou notas para este contrato.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {invoiceRows.map((n) => (
                <div key={n.id} style={rowStyle}>
                  <Link href={`/app/notas-fiscais/${n.id}`}>
                    <strong>nº {n.number}</strong> <span className="form-hint">competência {n.competence.slice(0, 7)}</span>
                  </Link>
                  <span>
                    {formatBRL(n.amountCents)} · <span className="form-hint">{n.status === "paid" ? "paga" : n.status === "approved" ? "aprovada" : n.status === "rejected" ? "recusada" : "em revisão"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "dados" && (
        <div style={{ display: "grid", gap: 24 }}>
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Dados do contrato</strong>
                <span>Edite as informações do contrato. Valor e término podem ficar em branco.</span>
              </div>
            </div>
            {canEdit ? (
              <EditContractForm
                contractId={id}
                members={members.map((m) => ({ id: m.id, label: `${m.name} · ${ROLE_LABELS[m.role]}` }))}
                values={{
                  name: c.name,
                  description: c.description ?? "",
                  responsibleUserId: c.responsibleUserId ?? "",
                  startDate: c.startDate,
                  endDate: c.endDate ?? "",
                  amount: c.amountCents !== null ? (c.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
                  invoiceDueDay: c.invoiceDueDay ? String(c.invoiceDueDay) : "",
                }}
              />
            ) : (
              <p className="form-hint">Este contrato foi cancelado e não pode ser editado.</p>
            )}
          </Card>

          {c.status === "active" && (
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Encerrar contrato</strong>
                  <span>O contrato sai de vigência e fica no histórico, e o colaborador fica livre para ter um contrato novo. Não dá para desfazer.</span>
                </div>
              </div>
              <EndContractButton contractId={id} />
            </Card>
          )}
        </div>
      )}
    </>
  )
}
