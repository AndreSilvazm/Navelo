import "server-only"
import { and, count, desc, eq, ilike, inArray, or, sql, type AnyColumn, type SQL } from "drizzle-orm"
import { db } from "@/db"
import {
  collaborators,
  memberships,
  users,
  type CollaboratorStatus,
} from "@/db/schema"
import { onlyDigits } from "@/lib/cnpj"
import { searchTerms } from "@/lib/search"
import { containsTerm } from "@/lib/search-sql"
import { TAB_STATUSES, type CollaboratorListData, type CollaboratorRow, type Tab, type TabCounts } from "./types"

const like_ = (column: AnyColumn, digits: string) => ilike(column, `%${digits}%`)

// vínculos ainda ativos da empresa
const base = (companyId: string) =>
  and(eq(collaborators.companyId, companyId), eq(memberships.status, "active"))

export async function getTabCounts(companyId: string): Promise<TabCounts> {
  const rows = await db
    .select({ status: collaborators.status, n: count() })
    .from(collaborators)
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .where(base(companyId))
    .groupBy(collaborators.status)

  const by = (statuses: CollaboratorStatus[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + r.n, 0)

  return {
    todos: rows.reduce((sum, r) => sum + r.n, 0),
    revisao: by(TAB_STATUSES.revisao),
    ativos: by(TAB_STATUSES.ativos),
    cadastro: by(TAB_STATUSES.cadastro),
    suspensos: by(TAB_STATUSES.suspensos),
    recusados: by(TAB_STATUSES.recusados),
  }
}

export async function listCollaborators(companyId: string, tab: Tab, query: string): Promise<CollaboratorRow[]> {
  const conditions: (SQL | undefined)[] = [base(companyId)]

  if (tab !== "todos" && tab !== "convites") conditions.push(inArray(collaborators.status, TAB_STATUSES[tab]))

  // Cada palavra digitada precisa aparecer no nome da pessoa, e-mail, razão social, nome fantasia,
  // cargo ou CNPJ — sem diferenciar acentos ("joao" acha "João") nem maiúsculas.
  // Assim "joao santos" acha a pessoa João cuja empresa é "... Santos ...".
  for (const term of searchTerms(query)) {
    const digits = onlyDigits(term)
    const match = (column: SQL | AnyColumn) => containsTerm(column, term)
    conditions.push(
      or(
        match(users.name),
        match(users.email),
        match(collaborators.legalName),
        match(collaborators.tradeName),
        match(collaborators.jobTitle),
        digits.length >= 3 ? like_(collaborators.cnpj, digits) : undefined,
      ),
    )
  }

  // andamento da documentação (obrigatórios aprovados / exigidos) vai como subconsulta:
  // uma ida só ao banco, em vez de uma por etapa
  return db
    .select({
      id: collaborators.id,
      status: collaborators.status,
      name: users.name,
      email: users.email,
      legalName: collaborators.legalName,
      tradeName: collaborators.tradeName,
      jobTitle: collaborators.jobTitle,
      cnpj: collaborators.cnpj,
      docsApproved: sql<number>`(
        select count(*)::int from collaborator_documents d
        join document_requirements r on r.id = d.requirement_id
        where d.collaborator_id = ${collaborators.id} and d.status = 'approved'
          and r.required and r.archived_at is null)`,
      docsRequired: sql<number>`(
        select count(*)::int from document_requirements r
        where r.company_id = ${collaborators.companyId} and r.required and r.archived_at is null)`,
    })
    .from(collaborators)
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(...conditions))
    // quem espera análise vem primeiro
    .orderBy(sql`(${collaborators.status} <> 'in_review')`, desc(collaborators.createdAt))
}

// Lista + contadores numa chamada só (consultas em paralelo)
export async function getCollaboratorListData(companyId: string, tab: Tab, query: string): Promise<CollaboratorListData> {
  const [rows, counts] = await Promise.all([listCollaborators(companyId, tab, query), getTabCounts(companyId)])
  return { rows, counts }
}
