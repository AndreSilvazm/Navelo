import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contractCollaborators, contractRequirements, contracts, memberships, users } from "@/db/schema"
import { Badge, Button, Card, Icon } from "@/figma/ui"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { CORPORATE_ROLES, requireSession } from "@/lib/auth/session"
import { formatBRL, formatDate, formatInvoiceDue } from "@/lib/format"
import { statusLabel, statusTone } from "../../colaboradores/types"
import { removeContractCollaborator, removeContractRequirement } from "../actions"
import { collaboratorOption } from "../options"
import { contractStatusOf } from "../status"
import { AddCollaborators } from "./add-collaborators"
import { EditContractForm } from "./edit-form"
import { RequirementForm } from "./requirement-form"

export const metadata: Metadata = { title: "Contrato" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TABS = [
  { id: "geral", label: "Visão geral" },
  { id: "colaboradores", label: "Colaboradores" },
  { id: "documentos", label: "Documentos" },
  { id: "notas", label: "Notas fiscais" },
  { id: "dados", label: "Dados do contrato" },
] as const
type TabId = (typeof TABS)[number]["id"]

const DAY = 86_400_000
const days = (from: string, to: number) => Math.floor((to - new Date(from).getTime()) / DAY)
const rowStyle = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" } as const

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

  // contrato, vínculos, documentos e o que cada aba precisa, tudo em paralelo (uma ida ao banco)
  const [[contract], people, docs, available, members] = await Promise.all([
    db
      .select({ c: contracts, responsible: users.name })
      .from(contracts)
      .leftJoin(users, eq(users.id, contracts.responsibleUserId))
      .where(and(eq(contracts.id, id), eq(contracts.companyId, session.company.id))),
    db
      .select({
        id: collaborators.id,
        status: collaborators.status,
        name: users.name,
        legalName: collaborators.legalName,
        cnpj: collaborators.cnpj,
        jobTitle: collaborators.jobTitle,
      })
      .from(contractCollaborators)
      .innerJoin(collaborators, eq(collaborators.id, contractCollaborators.collaboratorId))
      .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(contractCollaborators.contractId, id))
      .orderBy(asc(users.name)),
    db.select().from(contractRequirements).where(eq(contractRequirements.contractId, id)).orderBy(asc(contractRequirements.createdAt)),
    // colaboradores ativos da empresa que ainda não estão neste contrato
    tab === "colaboradores"
      ? db
          .select({ id: collaborators.id, name: users.name, legalName: collaborators.legalName, cnpj: collaborators.cnpj, jobTitle: collaborators.jobTitle })
          .from(collaborators)
          .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(
            and(
              eq(collaborators.companyId, session.company.id),
              eq(collaborators.status, "active"),
              eq(memberships.status, "active"),
              sql`${collaborators.id} not in (select collaborator_id from contract_collaborators where contract_id = ${id})`,
            ),
          )
          .orderBy(asc(users.name))
      : Promise.resolve([]),
    // equipe corporativa (para escolher o responsável ao editar)
    tab === "dados"
      ? db
          .select({ id: users.id, name: users.name, role: memberships.role })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(and(eq(memberships.companyId, session.company.id), eq(memberships.status, "active"), inArray(memberships.role, [...CORPORATE_ROLES])))
          .orderBy(asc(users.name))
      : Promise.resolve([]),
  ])
  if (!contract) notFound()

  const { c } = contract
  const status = contractStatusOf(c)
  const canEdit = c.status !== "canceled"
  const now = new Date().getTime()
  const href = (t: TabId) => (t === "geral" ? `/app/contratos/${id}` : `/app/contratos/${id}?aba=${t}`)
  const counts: Partial<Record<TabId, number>> = { colaboradores: people.length, documentos: docs.length }
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
          <span>{session.company.tradeName ?? session.company.legalName}</span>
          <strong>{c.name}</strong>
          <small>{c.description ?? "—"}</small>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
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
            <Fact label="Período" value={`${formatDate(c.startDate)} — ${c.endDate ? formatDate(c.endDate) : "Sem prazo final"}`} />
            <Fact label="Valor" muted={c.amountCents === null} value={c.amountCents !== null ? formatBRL(c.amountCents) : "A definir"} />
            <Fact label="Envio das notas fiscais" value={formatInvoiceDue(c.invoiceDueDay)} />
            <Fact label="Responsável" value={contract.responsible ?? "Sem responsável"} />
            <Fact label="Colaboradores" value={String(people.length)} />
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
                  <strong>Colaboradores</strong>
                  <span>{people.length} vinculado(s)</span>
                </div>
                <Link className="doc-review-next" href={href("colaboradores")}>
                  Ver todos →
                </Link>
              </div>
              {people.length === 0 ? (
                <p className="form-hint">Ninguém vinculado ainda.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {people.slice(0, 4).map((p) => (
                    <Link href={`/app/colaboradores/${p.id}`} key={p.id}>
                      <strong>{p.name}</strong> <span className="form-hint">{p.jobTitle}</span>
                    </Link>
                  ))}
                  {people.length > 4 && <span className="form-hint">e mais {people.length - 4}</span>}
                </div>
              )}
            </Card>
          </div>

          <div style={{ marginTop: 24 }}>
            <Card className="mvp-settings-card">
              <div className="mvp-section-heading">
                <div>
                  <strong>Documentos deste contrato</strong>
                  <span>{docs.length === 0 ? "Nenhum documento específico." : `${docs.length} exigido(s), ${requiredDocs} obrigatório(s).`}</span>
                </div>
                <Link className="doc-review-next" href={href("documentos")}>
                  Gerenciar →
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "colaboradores" && (
        <>
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Colaboradores do contrato</strong>
                <span>{people.length} vinculado(s) a este contrato</span>
              </div>
            </div>
            {people.length === 0 ? (
              <p className="form-hint">Nenhum colaborador vinculado ainda.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {people.map((p) => (
                  <div key={p.id} style={rowStyle}>
                    <Link href={`/app/colaboradores/${p.id}`} style={{ minWidth: 0 }}>
                      <strong>{p.name}</strong>
                      <div className="form-hint">{collaboratorOption(p).hint}</div>
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge tone={statusTone[p.status]}>{statusLabel[p.status]}</Badge>
                      {canEdit && (
                        <form action={removeContractCollaborator.bind(null, id, p.id)}>
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
            <div style={{ marginTop: 24 }}>
              <Card className="mvp-settings-card">
                <div className="mvp-section-heading">
                  <div>
                    <strong>Adicionar colaboradores</strong>
                    <span>Vincule mais pessoas a este contrato. Só aparecem colaboradores ativos que ainda não estão nele.</span>
                  </div>
                </div>
                <AddCollaborators contractId={id} options={available.map(collaboratorOption)} />
              </Card>
            </div>
          )}
        </>
      )}

      {tab === "documentos" && (
        <div className="mvp-settings-grid">
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Documentos deste contrato</strong>
                <span>Exigidos além dos documentos de cadastro da empresa.</span>
              </div>
            </div>
            {docs.length === 0 ? (
              <p className="form-hint">Nenhum documento específico.</p>
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
                  <strong>Adicionar documento</strong>
                  <span>Exigência só deste contrato.</span>
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
              <span>Prazo de envio para todos os colaboradores deste contrato.</span>
            </div>
          </div>
          <dl className="info-grid">
            <div className="info-field">
              <dt>Prazo de envio</dt>
              <dd>{formatInvoiceDue(c.invoiceDueDay)}</dd>
            </div>
            <div className="info-field">
              <dt>Colaboradores que enviam</dt>
              <dd>{people.length}</dd>
            </div>
          </dl>
          <p className="form-hint" style={{ marginTop: 16 }}>
            As notas enviadas pelos colaboradores deste contrato aparecerão aqui, com quem já enviou e quem está atrasado.
          </p>
        </Card>
      )}

      {tab === "dados" && (
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
      )}
    </>
  )
}
