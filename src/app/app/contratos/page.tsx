import type { Metadata } from "next"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contracts, memberships, users } from "@/db/schema"
import { Button, Card, PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { formatCnpj } from "@/lib/cnpj"
import { formatBRL, formatDate } from "@/lib/format"
import { ContractsTable } from "./contracts-table"
import { contractStatusOf } from "./status"

export const metadata: Metadata = { title: "Contratos" }

export default async function ContractsPage() {
  const session = await requireSession("corporate")

  const items = await db
    .select({
      id: contracts.id,
      name: contracts.name,
      status: contracts.status,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      amountCents: contracts.amountCents,
      collaboratorId: collaborators.id,
      collaborator: users.name,
      legalName: collaborators.legalName,
      cnpj: collaborators.cnpj,
    })
    .from(contracts)
    .leftJoin(collaborators, eq(collaborators.id, contracts.collaboratorId))
    .leftJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .leftJoin(users, eq(users.id, memberships.userId))
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
        subtitle="Cada contrato é de um colaborador. Abra um contrato para ver os dados e anexar os documentos dele."
        title="Contratos"
      />

      {items.length === 0 ? (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Nenhum contrato ainda</strong>
              <span>Crie o primeiro contrato escolhendo o colaborador a quem ele pertence.</span>
            </div>
          </div>
          <Button href="/app/contratos/novo" icon="plus">
            Novo contrato
          </Button>
        </Card>
      ) : (
        <Card className="workspace-table-card">
          <ContractsTable
            rows={items.map((c) => {
              const status = contractStatusOf(c)
              return {
                id: c.id,
                name: c.name,
                collaboratorId: c.collaboratorId,
                collaborator: c.collaborator,
                company: c.legalName,
                cnpj: c.cnpj ? formatCnpj(c.cnpj) : null,
                period: `${formatDate(c.startDate)} — ${c.endDate ? formatDate(c.endDate) : "Indeterminado"}`,
                startDate: c.startDate,
                amount: c.amountCents !== null ? formatBRL(c.amountCents) : "A definir",
                amountCents: c.amountCents,
                statusLabel: status.label,
                statusTone: status.tone,
              }
            })}
          />
        </Card>
      )}
    </>
  )
}
