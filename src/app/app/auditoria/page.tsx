import type { Metadata } from "next"
import Link from "next/link"
import { and, desc, eq, like, or } from "drizzle-orm"
import { db } from "@/db"
import { auditEvents } from "@/db/schema"
import { Badge, Card, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"

export const metadata: Metadata = { title: "Auditoria", robots: { index: false, follow: false } }

const PAGE_SIZE = 60

// Como cada ação aparece na lista, e o tom do selo
const LABEL: Record<string, { text: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }> = {
  "document.viewed": { text: "Visualizou documento", tone: "neutral" },
  "document.downloaded": { text: "Baixou documento", tone: "warning" },
  "invoice.viewed": { text: "Visualizou nota", tone: "neutral" },
  "invoice.downloaded": { text: "Baixou nota", tone: "warning" },
  "bank_change.requested": { text: "Pediu troca de conta", tone: "warning" },
  "bank_change.approved": { text: "Aprovou troca de conta", tone: "danger" },
  "bank_change.rejected": { text: "Recusou troca de conta", tone: "neutral" },
  "bank_change.canceled": { text: "Cancelou o pedido de troca", tone: "neutral" },
  "collaborator.approved": { text: "Liberou o acesso", tone: "success" },
  "collaborator.rejected": { text: "Recusou o acesso", tone: "danger" },
  "collaborator.suspended": { text: "Suspendeu o acesso", tone: "danger" },
  "collaborator.reactivated": { text: "Reativou o acesso", tone: "success" },
  "collaborator.reopened": { text: "Reabriu o cadastro", tone: "info" },
  "document.approved": { text: "Aprovou documento", tone: "success" },
  "document.rejected": { text: "Recusou documento", tone: "danger" },
  "invoice.approved": { text: "Aprovou nota", tone: "success" },
  "invoice.rejected": { text: "Recusou nota", tone: "danger" },
  "invoice.paid": { text: "Marcou nota como paga", tone: "success" },
  "collaborator.amount_changed": { text: "Mudou o valor mensal", tone: "warning" },
  "password.changed": { text: "Trocou a senha", tone: "info" },
}

const FILTERS = [
  { id: "tudo", label: "Tudo", match: null },
  { id: "arquivos", label: "Documentos e notas", match: ["%.viewed", "%.downloaded"] },
  { id: "banco", label: "Conta bancária", match: ["bank_change.%"] },
  { id: "decisoes", label: "Decisões", match: ["collaborator.%", "invoice.approved", "invoice.rejected", "invoice.paid", "document.approved", "document.rejected"] },
] as const

const quando = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })

// Mostra o conteúdo de "details" de um jeito legível, inclusive o de/para da conta bancária
function Detalhes({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null
  const obj = details as Record<string, unknown>
  const texto = (valor: unknown): string => {
    if (valor === null || valor === undefined) return "—"
    if (typeof valor === "object") {
      return Object.entries(valor as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ")
    }
    return String(valor)
  }
  const linhas = Object.entries(obj).filter(([k]) => k !== "colaboradorId")
  if (linhas.length === 0) return null
  return (
    <ul className="audit-details">
      {linhas.map(([chave, valor]) => (
        <li key={chave}>
          <b>{chave === "de" ? "De" : chave === "para" ? "Para" : chave}:</b> {texto(valor)}
        </li>
      ))}
    </ul>
  )
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ filtro?: string; pagina?: string }> }) {
  const session = await requireSession("corporate")
  const { filtro, pagina } = await searchParams

  const atual = FILTERS.find((f) => f.id === filtro) ?? FILTERS[0]
  const page = Math.max(1, Number(pagina) || 1)

  const rows = await db
    .select()
    .from(auditEvents)
    .where(
      atual.match
        ? and(eq(auditEvents.companyId, session.company.id), or(...atual.match.map((m) => like(auditEvents.action, m))))
        : eq(auditEvents.companyId, session.company.id),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE)

  const temMais = rows.length > PAGE_SIZE
  const lista = rows.slice(0, PAGE_SIZE)
  const href = (p: number) => `/app/auditoria?filtro=${atual.id}${p > 1 ? `&pagina=${p}` : ""}`

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

      <Card className="workspace-table-card">
        {lista.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            Nenhum registro neste filtro ainda.
          </p>
        ) : (
          <div className="workspace-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Sobre</th>
                  <th>Detalhes</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => {
                  const rotulo = LABEL[e.action] ?? { text: e.action, tone: "neutral" as const }
                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{quando(e.createdAt)}</td>
                      <td>
                        <strong>{e.actorName ?? "—"}</strong>
                        {e.actorRole && <div className="cell-sub">{e.actorRole}</div>}
                      </td>
                      <td>
                        <Badge tone={rotulo.tone}>{rotulo.text}</Badge>
                      </td>
                      <td>{e.targetLabel ?? "—"}</td>
                      <td>
                        <Detalhes details={e.details} />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{e.ipAddress ?? "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(page > 1 || temMais) && (
        <div className="portal-form-actions" style={{ justifyContent: "space-between" }}>
          {page > 1 ? <Link className="doc-review-next" href={href(page - 1)}>← Mais recentes</Link> : <span />}
          {temMais && (
            <Link className="doc-review-next" href={href(page + 1)}>
              Mais antigos →
            </Link>
          )}
        </div>
      )}
    </>
  )
}
