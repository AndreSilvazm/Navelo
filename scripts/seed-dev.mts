// Dados fictícios para testar a plataforma sem passar por convite.
// Idempotente: pode rodar várias vezes. Não use em produção.
//
//   npm run seed:dev

import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { eq, sql } from "drizzle-orm"
import { collaborators, companies, documentRequirements, memberships, users } from "../src/db/schema"
import { hashPassword } from "../src/lib/auth/password"

config({ path: ".env.local" })
const DB_URL = (process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL)!

if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") throw new Error("seed:dev não roda em produção")

const PASSWORD = "teste1234"

const people = [
  { email: "owner@acme.test", name: "Carlos Andrade", role: "owner" },
  { email: "agente@acme.test", name: "Marina Souza", role: "agent" },
  { email: "pj@acme.test", name: "João Silva", role: "collaborator" },
] as const

const client = postgres(DB_URL, { max: 1 })
const db = drizzle(client)

try {
  const passwordHash = await hashPassword(PASSWORD)

  const [company] = await db
    .insert(companies)
    .values({ legalName: "Acme Tecnologia LTDA", tradeName: "Acme", cnpj: "11222333000181" })
    .onConflictDoUpdate({ target: companies.cnpj, set: { status: "active" } })
    .returning()

  for (const p of people) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${p.email}`)
    const [user] = existing
      ? await db
          .update(users)
          .set({ name: p.name, passwordHash, status: "active" })
          .where(eq(users.id, existing.id))
          .returning()
      : await db.insert(users).values({ email: p.email, name: p.name, passwordHash }).returning()

    const [membership] = await db
      .insert(memberships)
      .values({ companyId: company.id, userId: user.id, role: p.role })
      .onConflictDoUpdate({
        target: [memberships.companyId, memberships.userId],
        set: { role: p.role, status: "active" },
      })
      .returning()

    // colaborador entra no primeiro acesso (só cria; não desfaz o andamento de quem já preencheu)
    if (p.role === "collaborator") {
      await db
        .insert(collaborators)
        .values({ membershipId: membership.id, companyId: company.id, jobTitle: "Desenvolvedor Back-end" })
        .onConflictDoUpdate({ target: collaborators.membershipId, set: { jobTitle: "Desenvolvedor Back-end" } })
    }
  }

  const existing = await db
    .select({ id: documentRequirements.id })
    .from(documentRequirements)
    .where(eq(documentRequirements.companyId, company.id))
  if (existing.length === 0) {
    await db.insert(documentRequirements).values([
      { companyId: company.id, name: "Cartão CNPJ", description: "Emitido há no máximo 90 dias" },
      { companyId: company.id, name: "Contrato social ou certificado MEI" },
      { companyId: company.id, name: "Certidão negativa de débitos federais" },
      { companyId: company.id, name: "Comprovante de endereço", required: false },
    ])
  }

  console.log(`Empresa: ${company.tradeName} (${company.legalName})\n`)
  for (const p of people) console.log(`${p.role.padEnd(13)} ${p.email.padEnd(18)} senha: ${PASSWORD}`)
} finally {
  await client.end()
}
