import "server-only"
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm"
import { dbAdmin as db } from "@/db/admin"
import { collaborators, memberships } from "@/db/schema"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Campos que seguem a pessoa de uma empresa para outra: os dados do CNPJ dela. (As contas bancárias
// moram na tabela bank_accounts, por pessoa, e já valem em todas as empresas sem precisar copiar.)
// O que é de cada empresa (documentos, contratos, notas) não é copiado.
export const PERSON_FIELDS = [
  "legalName",
  "tradeName",
  "cnpj",
  "phone",
  "zipCode",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
] as const

// Vincula a pessoa à empresa como colaborador. Quem já tem cadastro em outra empresa entra direto
// na etapa de documentos (os dados vêm junto); quem nunca preencheu começa pelos dados.
export async function joinAsCollaborator(tx: Tx, input: { userId: string; companyId: string; jobTitle: string | null }) {
  const { userId, companyId, jobTitle } = input

  const [membership] = await tx
    .insert(memberships)
    .values({ companyId, userId, role: "collaborator" })
    .onConflictDoUpdate({
      target: [memberships.companyId, memberships.userId],
      // só o vínculo de colaborador: um acesso corporativo da mesma empresa não é tocado
      targetWhere: sql`${memberships.role} = 'collaborator'`,
      set: { status: "active" },
    })
    .returning({ id: memberships.id })

  // convite novo para quem já era colaborador nesta empresa: atualiza o cargo, sem apagar o resto
  const [current] = await tx.select({ id: collaborators.id }).from(collaborators).where(eq(collaborators.membershipId, membership.id))
  if (current) {
    await tx.update(collaborators).set({ jobTitle }).where(eq(collaborators.id, current.id))
    return { membershipId: membership.id, copied: false }
  }

  // cadastro mais recente que a pessoa já completou em outra empresa
  const [source] = await tx
    .select()
    .from(collaborators)
    .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
    .where(and(eq(memberships.userId, userId), ne(collaborators.membershipId, membership.id), isNotNull(collaborators.profileCompletedAt)))
    .orderBy(desc(collaborators.profileCompletedAt))
    .limit(1)

  let copy: Partial<typeof collaborators.$inferInsert> = {}
  if (source) {
    const data = source.collaborators
    // o mesmo CNPJ não pode ser cadastrado duas vezes na mesma empresa
    const [clash] = data.cnpj
      ? await tx.select({ id: collaborators.id }).from(collaborators).where(and(eq(collaborators.companyId, companyId), eq(collaborators.cnpj, data.cnpj)))
      : []
    if (!clash) {
      copy = Object.fromEntries(PERSON_FIELDS.map((f) => [f, data[f]]))
      copy.profileCompletedAt = new Date()
      copy.status = "documents_pending"
    }
  }

  await tx.insert(collaborators).values({ membershipId: membership.id, companyId, jobTitle, ...copy })
  return { membershipId: membership.id, copied: !!copy.profileCompletedAt }
}
