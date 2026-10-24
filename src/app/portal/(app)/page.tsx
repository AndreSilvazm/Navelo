import type { Metadata } from "next"
import Link from "next/link"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { contractCollaborators, contracts, invoices } from "@/db/schema"
import { Badge, Button, PageHeading } from "@/figma/ui"
import { contractStatusOf } from "@/app/app/contratos/status"
import { acceptPendingInvitation } from "@/app/portal/actions"
import { getPortalCompanies } from "@/lib/portal-companies"
import { getCollaboratorContracts } from "@/lib/collaborator-contracts"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { computeDeadlineAlerts } from "@/lib/deadlines"
import { formatBRL, formatDate, formatInvoiceDue } from "@/lib/format"
import { competenceLabel, invoiceStatusLabel, invoiceStatusTone } from "@/lib/invoice-status"

export const metadata: Metadata = { title: "Início · Portal do colaborador" }

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()))
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"
}

// Início do colaborador: o que ele precisa fazer (prazo das notas, notas recusadas), quanto tem a
// receber e o resumo dos contratos. Tudo calculado do que já existe na plataforma.
export default async function PortalHomePage() {
  const { collaborator, session } = await requireActiveCollaborator()
  const company = session.company.tradeName ?? session.company.legalName
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) // AAAA-MM-DD

  const [{ invites }, contractList, links, rows] = await Promise.all([
    getPortalCompanies(session),
    getCollaboratorContracts(collaborator.id),
    db.select({ contractId: contractCollaborators.contractId, linkedAt: contractCollaborators.createdAt }).from(contractCollaborators).where(eq(contractCollaborators.collaboratorId, collaborator.id)),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        amountCents: invoices.amountCents,
        competence: invoices.competence,
        status: invoices.status,
        contractId: invoices.contractId,
        paidAt: invoices.paidAt,
        contract: contracts.name,
      })
      .from(invoices)
      .leftJoin(contracts, eq(contracts.id, invoices.contractId))
      .where(eq(invoices.collaboratorId, collaborator.id))
      .orderBy(desc(invoices.createdAt)),
  ])

  const linkedAt = new Map(links.map((l) => [l.contractId, l.linkedAt.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })]))
  const alerts = computeDeadlineAlerts(
    contractList
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, name: c.name, startDate: c.startDate, endDate: c.endDate, invoiceDueDay: c.invoiceDueDay, linkedAt: linkedAt.get(c.id) ?? c.startDate })),
    rows,
    today,
  )

  // notas recusadas que ainda não foram reenviadas (mesmo contrato e competência)
  const toResend = rows.filter(
    (r) => r.status === "rejected" && !rows.some((o) => o.status !== "rejected" && o.contractId === r.contractId && o.competence.slice(0, 7) === r.competence.slice(0, 7)),
  )

  const sum = (status: string) => rows.filter((r) => r.status === status).reduce((t, r) => t + r.amountCents, 0)
  const count = (status: string) => rows.filter((r) => r.status === status).length
  const month = today.slice(0, 7)
  const paidThisMonth = rows.filter((r) => r.status === "paid" && r.paidAt && r.paidAt.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).startsWith(month)).reduce((t, r) => t + r.amountCents, 0)

  const attention = [
    ...alerts.map((a) => ({ key: a.id, tag: a.daysLeft < 0 ? "Atraso" : a.daysLeft === 0 ? "Hoje" : `${a.daysLeft}d`, text: a.body, href: "/portal/notas-fiscais/enviar", danger: a.daysLeft < 0 })),
    ...toResend.map((r) => ({ key: r.id, tag: "Recusada", text: `A nota nº ${r.number} (${competenceLabel(r.competence)}) foi recusada. Veja o motivo e envie de novo.`, href: "/portal/notas-fiscais", danger: false })),
  ]

  return (
    <>
      <PageHeading
        action={
          <Button href="/portal/notas-fiscais/enviar" icon="plus">
            Enviar nota fiscal
          </Button>
        }
        subtitle={`Seu resumo com ${company}.`}
        title={`${greeting()}, ${session.user.name.split(" ")[0]}`}
      />

      <div className="dash">
        {invites.length > 0 && (
          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Convites pendentes</strong>
                <span>Outras empresas convidaram você. Ao aceitar, você completa só o que elas pedem.</span>
              </div>
            </div>
            <ul className="dash-contracts">
              {invites.map((i) => (
                <li key={i.id}>
                  <div>
                    <strong>{i.companyName}</strong>
                    <small>{i.jobTitle ? `Convite para ${i.jobTitle}` : "Convite para colaborar"}</small>
                  </div>
                  <form action={acceptPendingInvitation.bind(null, i.id)}>
                    <Button type="submit">Aceitar convite</Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="dash-kpis">
          <Link className="dash-kpi kpi-link" href="/portal/notas-fiscais">
            <span className="dash-kpi-label">A receber (aprovadas)</span>
            <strong>{formatBRL(sum("approved"))}</strong>
            <small>{count("approved")} nota(s) aguardando pagamento</small>
          </Link>
          <Link className="dash-kpi kpi-link" href="/portal/notas-fiscais">
            <span className="dash-kpi-label">Em revisão</span>
            <strong>{count("submitted")}</strong>
            <small>{formatBRL(sum("submitted"))}</small>
          </Link>
          <Link className="dash-kpi kpi-link" href="/portal/notas-fiscais">
            <span className="dash-kpi-label">Recebido no mês</span>
            <strong>{formatBRL(paidThisMonth)}</strong>
            <small>{formatBRL(sum("paid"))} no total</small>
          </Link>
        </div>

        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <strong>Precisa da sua atenção</strong>
              <span>Prazos de envio e notas que pedem uma ação sua</span>
            </div>
          </div>
          {attention.length === 0 ? (
            <p className="all-clear">Tudo em dia. Nada esperando por você agora.</p>
          ) : (
            <ul className="attn-list">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href}>
                    <b style={a.danger ? { background: "var(--zn-danger-bg)", color: "var(--zn-danger)" } : undefined}>{a.tag}</b>
                    <span>{a.text}</span>
                    <i aria-hidden="true">→</i>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="dash-grid">
          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>Últimas notas</strong>
                <span>As cinco mais recentes</span>
              </div>
              <Link className="doc-review-next" href="/portal/notas-fiscais">
                Ver todas →
              </Link>
            </div>
            {rows.length === 0 ? (
              <p className="form-hint">Você ainda não enviou nenhuma nota fiscal.</p>
            ) : (
              <ul className="dash-contracts">
                {rows.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <div>
                      <Link href="/portal/notas-fiscais">
                        {competenceLabel(r.competence)} · {formatBRL(r.amountCents)}
                      </Link>
                      <small>
                        nº {r.number}
                        {r.contract ? ` · ${r.contract}` : ""}
                      </small>
                    </div>
                    <Badge tone={invoiceStatusTone[r.status]}>{invoiceStatusLabel[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-head">
              <div>
                <strong>{contractList.length > 1 ? "Meus contratos" : "Meu contrato"}</strong>
                <span>Período e prazo de envio das notas</span>
              </div>
              <Link className="doc-review-next" href="/portal/contrato">
                Detalhes →
              </Link>
            </div>
            {contractList.length === 0 ? (
              <p className="form-hint">Você ainda não foi vinculado a nenhum contrato. Quando a empresa fizer isso, ele aparece aqui.</p>
            ) : (
              <ul className="dash-contracts">
                {contractList.map((c) => {
                  const status = contractStatusOf(c)
                  return (
                    <li key={c.id}>
                      <div>
                        <Link href="/portal/contrato">{c.name}</Link>
                        <small>
                          {formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : "sem prazo final"} · {formatInvoiceDue(c.invoiceDueDay)}
                        </small>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
