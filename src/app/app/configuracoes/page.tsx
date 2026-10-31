import type { Metadata } from "next"
import Link from "next/link"
import { and, count, eq, isNull, ne } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contracts, documentRequirements, memberships } from "@/db/schema"
import { Badge, Card, PageHeading } from "@/figma/ui"
import { listAccesses } from "@/lib/auth/accesses"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { requireSession } from "@/lib/auth/session"
import { formatCnpj } from "@/lib/cnpj"
import { CompanyForm } from "./company-form"
import { RequirementsSection } from "./requirements-section"
import { TeamSection } from "./team-section"

export const metadata: Metadata = { title: "Configurações" }

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="info-field">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

const TABS = [
  { id: "geral", label: "Geral" },
  { id: "documentos", label: "Documentos exigidos" },
  { id: "equipe", label: "Equipe" },
] as const
type TabId = (typeof TABS)[number]["id"]

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const [session, { aba }] = await Promise.all([requireSession("corporate"), searchParams])
  const companyId = session.company.id
  const tab: TabId = TABS.find((t) => t.id === aba)?.id ?? "geral"

  const [accesses, [people], [team], [activeContracts], [docs]] = await Promise.all([
    listAccesses(session.user.id),
    db.select({ n: count() }).from(collaborators).where(eq(collaborators.companyId, companyId)),
    db
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.companyId, companyId), eq(memberships.status, "active"), ne(memberships.role, "collaborator"))),
    db.select({ n: count() }).from(contracts).where(and(eq(contracts.companyId, companyId), eq(contracts.status, "active"))),
    db.select({ n: count() }).from(documentRequirements).where(and(eq(documentRequirements.companyId, companyId), isNull(documentRequirements.archivedAt))),
  ])

  const canEdit = session.role === "owner" || session.role === "admin"
  const alsoCollaborator = accesses.some((a) => a.companyId === companyId && a.area === "collaborator")

  return (
    <>
      <PageHeading subtitle="Dados da empresa, sua conta, documentos exigidos e equipe." title="Configurações" />

      <nav aria-label="Seções das configurações" className="page-tabs">
        {TABS.map((t) => (
          <Link aria-current={tab === t.id ? "page" : undefined} href={t.id === "geral" ? "/app/configuracoes" : `/app/configuracoes?aba=${t.id}`} key={t.id}>
            {t.label}
            {t.id === "documentos" && <span className="page-tab-count">{docs.n}</span>}
            {t.id === "equipe" && <span className="page-tab-count">{team.n}</span>}
          </Link>
        ))}
      </nav>

      {tab === "geral" && (
      <div className="mvp-settings-grid">
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Empresa</strong>
              <span>
                Razão social e CNPJ são o cadastro legal e não mudam por aqui.
                {!canEdit && " Só o proprietário ou um administrador altera o nome."}
              </span>
            </div>
          </div>
          <dl className="info-grid" style={{ marginBottom: 20 }}>
            <Field label="Razão social" value={session.company.legalName} />
            <Field label="CNPJ" value={formatCnpj(session.company.cnpj)} />
            <Field label="Colaboradores" value={String(people.n)} />
            <Field label="Contratos ativos" value={String(activeContracts.n)} />
            <Field label="Pessoas na equipe" value={String(team.n)} />
          </dl>
          <CompanyForm canEdit={canEdit} tradeName={session.company.tradeName ?? ""} />
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Minha conta</strong>
              <span>Seu acesso a esta empresa.</span>
            </div>
            <Badge tone="info">{ROLE_LABELS[session.role]}</Badge>
          </div>
          <dl className="info-grid">
            <Field label="Nome" value={session.user.name} />
            <Field label="E-mail de acesso" value={session.user.email} />
            <Field label="Papel nesta empresa" value={ROLE_LABELS[session.role]} />
            <Field label="Também é colaborador aqui" value={alsoCollaborator ? "Sim" : "Não"} />
          </dl>
          {accesses.length > 1 && (
            <p className="form-hint" style={{ marginTop: 16 }}>
              Você tem {accesses.length} acessos. Para trocar, use “Trocar de acesso” no menu lateral.
            </p>
          )}
        </Card>
      </div>
      )}

      {tab === "documentos" && <RequirementsSection />}
      {tab === "equipe" && <TeamSection />}
    </>
  )
}
