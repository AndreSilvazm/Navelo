import "server-only"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { db } from "@/db"
import { contractRequirements, contracts, users } from "@/db/schema"

export type CollaboratorContract = {
  id: string
  name: string
  description: string | null
  status: "active" | "ended" | "canceled"
  startDate: string
  endDate: string | null
  invoiceDueDay: number | null
  responsible: string | null
  requirements: { name: string; required: boolean }[]
}

// Contratos do colaborador, como ele os vê: período, prazo das notas, responsável e documentos.
// (O valor do contrato é da empresa e não aparece aqui.)
export async function getCollaboratorContracts(collaboratorId: string): Promise<CollaboratorContract[]> {
  const rows = await db
    .select({
      id: contracts.id,
      name: contracts.name,
      description: contracts.description,
      status: contracts.status,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      invoiceDueDay: contracts.invoiceDueDay,
      responsible: users.name,
    })
    .from(contracts)
    .leftJoin(users, eq(users.id, contracts.responsibleUserId))
    .where(and(eq(contracts.collaboratorId, collaboratorId), ne(contracts.status, "canceled")))
    .orderBy(asc(contracts.name))
  if (rows.length === 0) return []

  const reqs = await db
    .select({ contractId: contractRequirements.contractId, name: contractRequirements.name, required: contractRequirements.required })
    .from(contractRequirements)
    .where(
      inArray(
        contractRequirements.contractId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(contractRequirements.createdAt))

  return rows.map((r) => ({ ...r, requirements: reqs.filter((q) => q.contractId === r.id).map(({ name, required }) => ({ name, required })) }))
}
