/**
 * Cria uma empresa corporativa de teste no STAGING, com o convite do proprietário.
 *
 *   npm run seed:staging -- --owner-email voce@empresa.com --owner-name "Seu Nome Completo"
 *   npm run seed:staging voce@empresa.com André            (forma curta, a que funciona no PowerShell:
 *     lá o "--" é engolido e o npm trata --owner-email como opção dele; o primeiro argumento solto
 *     vira o e-mail e o resto vira o nome)
 *
 * Por que é um script e não uma migração do Drizzle: migração roda em todo ambiente que a
 * aplicar, inclusive na produção. Este seed recusa qualquer ambiente que não seja o STAGING.
 * E não grava senha nenhuma: o dono define a própria ao aceitar o convite.
 *
 * Antes de rodar: no .env.local, comente o bloco LOCAL e descomente o STAGING, com
 *   - DATABASE_ADMIN_URL  (navelo_admin: é quem insere empresa e convite)
 *   - AUTH_SECRET         (IGUAL ao da infra da develop, senão o link do convite não valida)
 *   - APP_URL             (o endereço público da develop, para o link sair certo)
 *
 * Seguro de repetir: reaproveita a empresa (pelo CNPJ), não duplica os documentos exigidos e
 * troca o convite pendente por um novo.
 *
 * Opções: --company-name, --trade-name, --cnpj, --owner-email, --owner-name, --send (envia o
 * convite por e-mail), --yes (não pergunta).
 */
import { and, eq, isNull, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import { parseArgs } from "node:util"
import { createInterface } from "node:readline/promises"
import postgres from "postgres"
import { companies, documentRequirements, invitations, memberships, users } from "../src/db/schema"
import { generateToken, hashToken, normalizeEmail } from "../src/lib/auth/tokens"
import { sendInvitationEmail } from "../src/lib/email"
import { LABEL, blockingProblems, loadActiveEnv, projectOf, readActiveEnv } from "./lib/active-env"

const INVITE_TTL_DAYS = 7

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "company-name": { type: "string", default: "Empresa Teste Navelo Ltda" },
    "trade-name": { type: "string", default: "Teste Navelo" },
    cnpj: { type: "string", default: "11222333000181" }, // CNPJ de exemplo com dígitos verificadores válidos
    "owner-email": { type: "string" },
    "owner-name": { type: "string" },
    send: { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
})

// ---- travas: só o STAGING, e só com o arquivo em ordem --------------------------------
const env = readActiveEnv()
const problemas = blockingProblems(env)
if (problemas.length > 0) {
  for (const p of problemas) console.error(`✗ ${p}`)
  process.exit(1)
}
if (env.appEnv !== "staging") {
  console.error(`✗ Este seed só roda no STAGING, e o ambiente ativo é ${LABEL[env.appEnv!]}.`)
  console.error("  No .env.local, comente o bloco ativo e descomente o bloco STAGING.")
  process.exit(1)
}

loadActiveEnv()
// forma curta: o primeiro argumento solto é o e-mail, o resto é o nome
const ownerEmailRaw = values["owner-email"] ?? positionals[0]
const ownerName = values["owner-name"] ?? (positionals.slice(1).join(" ") || undefined)
const ownerEmail = ownerEmailRaw ? normalizeEmail(ownerEmailRaw) : ""
const cnpj = (values.cnpj ?? "").replace(/\D/g, "")
const faltando: string[] = []
if (!process.env.DATABASE_ADMIN_URL) faltando.push("DATABASE_ADMIN_URL (o navelo_admin do staging)")
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) faltando.push("AUTH_SECRET (o MESMO da infra da develop, mínimo 32 caracteres)")
if (!process.env.APP_URL) faltando.push("APP_URL (o endereço público da develop)")
if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) faltando.push("o e-mail do dono (--owner-email, ou o primeiro argumento)")
if (cnpj.length !== 14) faltando.push("--cnpj com 14 dígitos")
if (faltando.length > 0) {
  console.error("✗ Falta preencher:")
  for (const f of faltando) console.error(`   - ${f}`)
  process.exit(1)
}

const appUrl = process.env.APP_URL!.replace(/\/$/, "")
const alvo = projectOf(process.env.DATABASE_ADMIN_URL)
console.log(`\nAmbiente:  ${LABEL.staging}`)
console.log(`Projeto:   ${alvo?.ref}  (${alvo?.host})`)
console.log(`Usuário:   ${alvo?.user}`)
console.log(`Empresa:   ${values["company-name"]}  (CNPJ ${cnpj})`)
console.log(`Dono:      ${ownerEmail}${ownerName ? `  (${ownerName})` : ""}`)
console.log(`Link usa:  ${appUrl}`)
if (/localhost|127\.0\.0\.1/.test(appUrl)) console.warn("⚠ APP_URL aponta para localhost: o link do convite só abre na sua máquina.")

if (!values.yes) {
  if (!process.stdin.isTTY) {
    console.error("\n✗ Sem terminal interativo para confirmar. Rode num terminal, ou use --yes.")
    process.exit(1)
  }
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  const resposta = (await leitor.question('\nCriar esta empresa no STAGING? Digite "sim": ')).trim().toLowerCase()
  leitor.close()
  if (resposta !== "sim") {
    console.log("Cancelado. Nada foi criado.")
    process.exit(0)
  }
}

const client = postgres(process.env.DATABASE_ADMIN_URL!, { max: 1 })
const db = drizzle(client)

// documentos que uma empresa costuma exigir do colaborador PJ
const EXIGENCIAS = [
  { name: "Cartão CNPJ", description: "Emitido pela Receita Federal, de preferência com menos de 90 dias", required: true },
  { name: "Comprovante de endereço da empresa", description: "Conta de consumo ou documento equivalente, dos últimos 90 dias", required: true },
  { name: "Contrato social ou certificado MEI", description: "Documento de constituição da empresa", required: true },
  { name: "Certidão negativa de débitos", description: "Federal, se a empresa exigir", required: false },
]

try {
  const token = generateToken()
  const resultado = await db.transaction(async (tx) => {
    // empresa: reaproveita se o CNPJ já existe
    let [empresa] = await tx.select().from(companies).where(eq(companies.cnpj, cnpj))
    const criada = !empresa
    if (!empresa) {
      ;[empresa] = await tx.insert(companies).values({ legalName: values["company-name"]!, tradeName: values["trade-name"], cnpj }).returning()
    }

    // documentos exigidos: só os que ainda não existem
    const existentes = new Set((await tx.select({ name: documentRequirements.name }).from(documentRequirements).where(eq(documentRequirements.companyId, empresa.id))).map((r) => r.name))
    const novos = EXIGENCIAS.filter((e) => !existentes.has(e.name))
    if (novos.length > 0) await tx.insert(documentRequirements).values(novos.map((e) => ({ ...e, companyId: empresa.id })))

    // o dono já tem acesso a esta empresa?
    const [jaDono] = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.companyId, empresa.id), eq(memberships.role, "owner"), sql`lower(${users.email}) = ${ownerEmail}`))
    if (jaDono) return { empresa, criada, novos: novos.length, convite: false as const }

    // um convite pendente por e-mail e papel: o antigo é encerrado e sai um novo
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitations.companyId, empresa.id), sql`lower(${invitations.email}) = ${ownerEmail}`, eq(invitations.role, "owner"), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
    await tx.insert(invitations).values({
      companyId: empresa.id,
      email: ownerEmail,
      name: ownerName,
      role: "owner",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    })
    return { empresa, criada, novos: novos.length, convite: true as const }
  })

  console.log(`\n${resultado.criada ? "Empresa criada" : "Empresa já existia (reaproveitada)"}: ${resultado.empresa.legalName} (${resultado.empresa.id})`)
  console.log(`Documentos exigidos novos: ${resultado.novos}`)
  if (!resultado.convite) {
    console.log(`\n${ownerEmail} já é proprietário desta empresa. Entre normalmente em ${appUrl}/login.`)
  } else {
    const link = `${appUrl}/convite/${token}`
    console.log(`\nConvite do proprietário (vale ${INVITE_TTL_DAYS} dias, uso único):`)
    console.log(link)
    console.log("\nAbra o link, crie a sua senha e entre. A senha nunca passa por aqui.")
    if (values.send) {
      await sendInvitationEmail({
        to: ownerEmail,
        name: ownerName,
        companyName: values["trade-name"] ?? values["company-name"]!,
        role: "owner",
        inviteUrl: link,
        expiresInDays: INVITE_TTL_DAYS,
      })
      console.log(`E-mail enviado para ${ownerEmail}`)
    }
  }
} finally {
  await client.end()
}
