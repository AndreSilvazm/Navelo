import type { Metadata } from "next"
import Link from "next/link"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { contracts } from "@/db/schema"
import { Badge, Button, Card, Icon, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { formatBRL, formatDate } from "@/lib/format"
import { contractStatusOf } from "./status"

export const metadata: Metadata = { title: "Contratos" }

export default async function ContractsPage() {
  const session = await requireSession("corporate")

  const items = await db
    .select({
      id: contracts.id,
      name: contracts.name,
      description: contracts.description,
      status: contracts.status,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      amountCents: contracts.amountCents,
      collaborators: sql<number>`(select count(*)::int from contract_collaborators cc where cc.contract_id = ${contracts.id})`,
    })
    .from(contracts)
    .where(eq(contracts.companyId, session.company.id))
    .orderBy(desc(contracts.createdAt))

  return (
    <>
      <PageHeading
        action={
          <Button href="/app/contratos/novo" icon="plus">
            Novo contrato
          </Button>
        }
        subtitle="Configure requisitos e acompanhe colaboradores por contrato."
        title="Contratos"
      />

      {items.length === 0 ? (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Nenhum contrato ainda</strong>
              <span>Crie o primeiro contrato para vincular colaboradores e documentos.</span>
            </div>
          </div>
          <Button href="/app/contratos/novo" icon="plus">
            Novo contrato
          </Button>
        </Card>
      ) : (
        <div className="mvp-contract-list">
          {items.map((c) => {
            const status = contractStatusOf(c)
            return (
              <Link href={`/app/contratos/${c.id}`} key={c.id}>
                <Card className="mvp-contract-row">
                  <span className="entity-icon">
                    <Icon name="contract" size={19} />
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <span>{c.description ?? "—"}</span>
                  </div>
                  <div>
                    <span>Período</span>
                    <strong>
                      {formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : "Indeterminado"}
                    </strong>
                  </div>
                  <div>
                    <span>Colaboradores</span>
                    <strong>
                      {c.collaborators}
                      {c.amountCents !== null && ` · ${formatBRL(c.amountCents)}`}
                    </strong>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <Icon name="chevron" size={17} />
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
