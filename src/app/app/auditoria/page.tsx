import type { Metadata } from "next"
import Link from "next/link"
import { and, count, desc, eq, gte, inArray, isNotNull, like, lt, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { auditEvents } from "@/db/schema"
import { Card, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { fold, searchTerms } from "@/lib/search"
import { containsTerm } from "@/lib/search-sql"
import { AuditFilters } from "./audit-filters"
import { AuditPager } from "./audit-pager"
import { LABEL } from "./audit-labels"
import { AuditTable } from "./audit-table"

export const metadata: Metadata = { title: "Auditoria", robots: { index: false, follow: false } }

const SIZES = [25, 50, 100]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

const FILTERS = [
  { id: "tudo", label: "Tudo", match: null },
  { id: "arquivos", label: "Documentos e notas", match: ["%.viewed", "%.downloaded"] },
  { id: "banco", label: "Conta bancária", match: ["bank_change.%"] },
  { id: "decisoes", label: "Decisões", match: ["collaborator.%", "invoice.approved", "invoice.rejected", "invoice.paid", "document.approved", "document.rejected"] },
] as const

const quando = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ filtro?: string; pagina?: string; tam?: string; acao?: string; quem?: string; de?: string; ate?: string; q?: string }> }) {
  const session = await requireSession("corporate")
  const { filtro, pagina, tam, acao, quem, de, ate, q } = await searchParams
  const companyId = session.company.id

  const atual = FILTERS.find((f) => f.id === filtro) ?? FILTERS[0]
  const page = Math.max(1, Number(pagina) || 1)
  const size = SIZES.includes(Number(tam)) ? Number(tam) : 25

  // filtros da URL: só valem valores conhecidos (ação da lista, UUID, data AAAA-MM-DD)
  const acaoOk = acao && acao in LABEL ? acao : undefined
  const quemOk = quem && UUID_RE.test(quem) ? quem : undefined
  const deOk = de && DAY_RE.test(de) ? de : undefined
  const ateOk = ate && DAY_RE.test(ate) ? ate : undefined

  // busca livre: cada palavra precisa aparecer em algum campo (pessoa, papel, alvo, detalhes, IP) ou no nome da ação
  const busca = (q ?? "").trim().slice(0, 100)
  const termConditions = searchTerms(busca).map((term) => {
    const actionIds = Object.entries(LABEL).filter(([, v]) => fold(v.text).includes(term)).map(([id]) => id)
    return or(
      containsTerm(auditEvents.actorName, term),
      containsTerm(auditEvents.actorRole, term),
      containsTerm(auditEvents.targetLabel, term),
      containsTerm(sql`${auditEvents.details}::text`, term),
      containsTerm(sql`${auditEvents.ipAddress}::text`, term),
      actionIds.length ? inArray(auditEvents.action, actionIds) : undefined,
    )
  })

  const conditions = [
    ...termConditions,
    eq(auditEvents.companyId, companyId),
    atual.match ? or(...atual.match.map((m) => like(auditEvents.action, m))) : undefined,
    acaoOk ? eq(auditEvents.action, acaoOk) : undefined,
    quemOk ? eq(auditEvents.actorUserId, quemOk) : undefined,
    deOk ? gte(auditEvents.createdAt, new Date(`${deOk}T00:00:00-03:00`)) : undefined,
    // o dia final entra inteiro: vale até a meia-noite seguinte
    ateOk ? lt(auditEvents.createdAt, new Date(new Date(`${ateOk}T00:00:00-03:00`).getTime() + 86_400_000)) : undefined,
  ]

  const [rows, [{ total }], people] = await Promise.all([
    db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(size)
      .offset((page - 1) * size),
    db.select({ total: count() }).from(auditEvents).where(and(...conditions)),
    // quem aparece no registro desta empresa (para o filtro de pessoa)
    db
      .selectDistinct({ id: auditEvents.actorUserId, name: auditEvents.actorName })
      .from(auditEvents)
      .where(and(eq(auditEvents.companyId, companyId), isNotNull(auditEvents.actorUserId)))
      .limit(200),
  ])

  const lista = rows
  const actors = [...new Map(people.map((p) => [p.id!, p.name ?? "Sem nome"])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  const actions = Object.entries(LABEL)
    .map(([value, { text }]) => ({ value, label: text }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  const extra = new URLSearchParams()
  for (const [k, v] of Object.entries({ acao: acaoOk, quem: quemOk, de: deOk, ate: ateOk, q: busca })) if (v) extra.set(k, v)
  const pagerParams = Object.fromEntries([["filtro", atual.id], ...extra.entries()])

  return (
    <>
      <PageHeading
        subtitle="Quem fez o quê, quando e de onde. O registro não pode ser editado nem apagado pela plataforma."
        title="Auditoria"
      />

      <nav aria-label="Filtros da auditoria" className="page-tabs">
        {FILTERS.map((f) => (
          <Link aria-current={f.id === atual.id ? "page" : undefined} href={`/app/auditoria?filtro=${f.id}`} key={f.id}>
            {f.label}
          </Link>
        ))}
      </nav>

      <AuditFilters actions={actions} actors={actors} values={{ filtro: atual.id, acao: acaoOk, quem: quemOk, de: deOk, ate: ateOk, q: busca || undefined }} />

      <Card className="workspace-table-card">
        {lista.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            Nenhum registro neste filtro ainda.
          </p>
        ) : (
          <AuditTable
            rows={lista.map((e) => ({
              id: e.id,
              when: quando(e.createdAt),
              createdAt: e.createdAt.toISOString(),
              actorName: e.actorName,
              actorRole: e.actorRole,
              action: e.action,
              targetLabel: e.targetLabel,
              details: e.details,
              ipAddress: e.ipAddress,
            }))}
          />
        )}
      </Card>

      <AuditPager page={page} params={pagerParams} size={size} total={total} />
    </>
  )
}
