// Cria uma empresa nova (fictícia) com uma conta corporativa de proprietário, só para o
// desenvolvimento local. Idempotente: pode rodar várias vezes. Recusa rodar fora do ambiente local.
//
//   npm run seed:dev-empresa

import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { eq, sql } from "drizzle-orm"
import { companies, documentRequirements, memberships, users } from "../src/db/schema"
import { hashPassword } from "../src/lib/auth/password"
import { isValidCnpj } from "../src/lib/cnpj"

config({ path: ".env.local" })

if (process.env.APP_ENV !== "development") {
  throw new Error(`seed:dev-empresa só roda com APP_ENV=development (o ambiente ativo é "${process.env.APP_ENV ?? "sem APP_ENV"}").`)
}

const DB_URL = (process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL)!

const PASSWORD = "Horizonte@2026"
const COMPANY = { legalName: "Horizonte Logística e Transportes LTDA", tradeName: "Horizonte Logística", cnpj: "45092137000151" }
const OWNER = { email: "beatriz.moreira@horizonte.test", name: "Beatriz Moreira" }

if (!isValidCnpj(COMPANY.cnpj)) throw new Error("CNPJ da seed inválido")

const client = postgres(DB_URL, { max: 1 })
const db = drizzle(client)

try {
  const passwordHash = await hashPassword(PASSWORD)

  const [company] = await db
    .insert(companies)
    .values(COMPANY)
    .onConflictDoUpdate({ target: companies.cnpj, set: { status: "active" } })
    .returning()

  const [found] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${OWNER.email}`)
  const [user] = found
    ? await db.update(users).set({ name: OWNER.name, passwordHash, status: "active" }).where(eq(users.id, found.id)).returning()
    : await db.insert(users).values({ email: OWNER.email, name: OWNER.name, passwordHash }).returning()

  await db
    .insert(memberships)
    .values({ companyId: company.id, userId: user.id, role: "owner" })
    // o índice único é parcial (vínculo corporativo x de colaborador): o ON CONFLICT precisa repetir o filtro
    .onConflictDoUpdate({
      target: [memberships.companyId, memberships.userId],
      targetWhere: sql`${memberships.role} <> 'collaborator'`,
      set: { role: "owner", status: "active" },
    })

  const requirements = await db
    .select({ id: documentRequirements.id })
    .from(documentRequirements)
    .where(eq(documentRequirements.companyId, company.id))
  if (requirements.length === 0) {
    await db.insert(documentRequirements).values([
      { companyId: company.id, name: "Cartão CNPJ", description: "Emitido há no máximo 90 dias" },
      { companyId: company.id, name: "Contrato social ou certificado MEI" },
      { companyId: company.id, name: "Certidão negativa de débitos federais" },
      { companyId: company.id, name: "Comprovante de endereço", required: false },
    ])
  }

  console.log(`Empresa:  ${company.tradeName} (${company.legalName})`)
  console.log(`CNPJ:     ${company.cnpj}`)
  console.log(`Entrar:   ${OWNER.email}`)
  console.log(`Senha:    ${PASSWORD}`)
  console.log(`Papel:    proprietário (acesso em /app)`)
} finally {
  await client.end()
}
