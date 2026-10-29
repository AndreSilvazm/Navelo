// Cria uma empresa e o convite do owner. Como não existe cadastro aberto,
// este é o único ponto de entrada de uma empresa nova (operado pelo Navelo).
//
//   npm run company:create -- --cnpj 84128450000122 --name "Acme Ltda" \
//     --owner-email ana@acme.com --owner-name "Ana Souza" [--trade-name Acme]

import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { parseArgs } from "node:util"
import { companies, invitations } from "../src/db/schema"
import { sendInvitationEmail } from "../src/lib/email"
import { generateToken, hashToken, normalizeEmail } from "../src/lib/auth/tokens"

config({ path: ".env.local" })
// operação de sistema: usa o admin quando existe
const DB_URL = (process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL)!

const INVITE_TTL_DAYS = 7

const { values } = parseArgs({
  options: {
    cnpj: { type: "string" },
    name: { type: "string" },
    "trade-name": { type: "string" },
    "owner-email": { type: "string" },
    "owner-name": { type: "string" },
    send: { type: "boolean" },
  },
})

const cnpj = values.cnpj?.replace(/\D/g, "")
if (!cnpj || cnpj.length !== 14 || !values.name || !values["owner-email"]) {
  console.error("Uso: --cnpj <14 dígitos> --name <razão social> --owner-email <email> [--owner-name] [--trade-name] [--send]")
  process.exit(1)
}

const client = postgres(DB_URL, { max: 1 })
const db = drizzle(client)

try {
  const token = generateToken()

  const company = await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({ legalName: values.name!, tradeName: values["trade-name"], cnpj })
      .returning()

    await tx.insert(invitations).values({
      companyId: company.id,
      email: normalizeEmail(values["owner-email"]!),
      name: values["owner-name"],
      role: "owner",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })

    return company
  })

  const appUrl = process.env.APP_URL ?? "http://localhost:3000"
  console.log(`Empresa criada: ${company.legalName} (${company.id})`)
  console.log(`Convite do owner (válido por ${INVITE_TTL_DAYS} dias):`)
  console.log(`${appUrl}/convite/${token}`)

  if (values.send) {
    await sendInvitationEmail({
      to: normalizeEmail(values["owner-email"]!),
      name: values["owner-name"],
      companyName: values["trade-name"] ?? values.name!,
      role: "owner",
      inviteUrl: `${appUrl}/convite/${token}`,
      expiresInDays: INVITE_TTL_DAYS,
    })
    console.log(`E-mail enviado para ${values["owner-email"]}`)
  }
} finally {
  await client.end()
}
