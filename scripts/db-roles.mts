/**
 * Cria (ou atualiza) os usuários do banco de um ambiente.
 *
 *   npm run db:roles      (usa o bloco ativo do .env.local: DATABASE_MIGRATE_URL, NAVELO_APP_PASSWORD
 *                          e NAVELO_ADMIN_PASSWORD)
 *
 * - navelo_app:   usuário da aplicação. Sujeito ao RLS, sem DDL, sem acesso às tabelas de
 *                 sistema (sessions, rate_limits, password_resets).
 * - navelo_admin: fluxos de sistema que acontecem antes de existir sessão (login, convite, troca
 *                 de senha, auditoria). Ignora o RLS, mas só faz DML: não altera estrutura.
 *
 * As permissões de cada tabela são dadas pela migração de políticas. Este script só cria os
 * papéis e define as senhas, e pode ser repetido para trocar a senha.
 */
import { createInterface } from "node:readline/promises"
import postgres from "postgres"
import { LABEL, blockingProblems, loadActiveEnv, projectOf, readActiveEnv } from "./lib/active-env"

const ambiente = readActiveEnv()
const travas = blockingProblems(ambiente)
if (travas.length > 0) {
  for (const t of travas) console.error(`✗ ${t}`)
  process.exit(1)
}
loadActiveEnv()
const alvo = projectOf(process.env.DATABASE_MIGRATE_URL)
console.log(`Ambiente: ${LABEL[ambiente.appEnv!]} — projeto ${alvo?.ref}`)
// trocar a senha dos usuários do banco de produção não é rotina: pede confirmação digitada
if (ambiente.appEnv === "production") {
  if (!process.stdin.isTTY) throw new Error("Produção exige terminal interativo para confirmar.")
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  const resposta = (await leitor.question('Isto cria/atualiza os usuários do banco de PRODUÇÃO. Digite "criar usuarios em producao": ')).trim().toLowerCase()
  leitor.close()
  if (resposta !== "criar usuarios em producao") {
    console.log("Cancelado.")
    process.exit(0)
  }
}

const ownerUrl = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL
const appPassword = process.env.NAVELO_APP_PASSWORD
const adminPassword = process.env.NAVELO_ADMIN_PASSWORD

if (!ownerUrl) throw new Error("Defina DATABASE_MIGRATE_URL (a conexão do dono do banco).")
if (!appPassword || appPassword.length < 24) throw new Error("NAVELO_APP_PASSWORD ausente ou curta demais (mínimo 24 caracteres).")
if (!adminPassword || adminPassword.length < 24) throw new Error("NAVELO_ADMIN_PASSWORD ausente ou curta demais (mínimo 24 caracteres).")

const sql = postgres(ownerUrl, { max: 1 })

// senhas só com caracteres seguros: vão dentro de literais SQL e de URLs
const seguro = (valor: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) throw new Error("A senha deve usar apenas letras, números, _ e -.")
  return valor
}

async function papel(nome: string, senha: string, opcoes: string) {
  const [existe] = await sql`select 1 from pg_roles where rolname = ${nome}`
  const clausula = `login nosuperuser nocreatedb nocreaterole noreplication ${opcoes} password '${seguro(senha)}'`
  if (existe) {
    // papel que já existe: muda só senha e limite. O provedor recusa ALTER com SUPERUSER/BYPASSRLS na
    // cláusula (mesmo repetindo o valor atual), e esses atributos são definidos na criação.
    const limite = /connection limit (d+)/.exec(opcoes)?.[1]
    await sql.unsafe(`alter role ${nome} with login ${limite ? `connection limit ${limite} ` : ""}password '${seguro(senha)}'`)
  } else {
    await sql.unsafe(`create role ${nome} with ${clausula}`)
  }
  return existe ? "atualizado" : "criado"
}

try {
  // o app nunca ignora o RLS e tem teto de conexões
  console.log("navelo_app:  ", await papel("navelo_app", appPassword, "nobypassrls connection limit 15"))
  // o admin ignora o RLS (precisa, para funcionar antes da sessão) e também tem teto
  const admin = await papel("navelo_admin", adminPassword, "bypassrls connection limit 15").catch(async (erro) => {
    // em alguns provedores só superusuário concede BYPASSRLS
    console.warn("BYPASSRLS recusado:", erro instanceof Error ? erro.message : erro)
    throw erro
  })
  console.log("navelo_admin:", admin)

  // permissão de conectar e de usar o schema; as tabelas vêm na migração de políticas
  await sql.unsafe(`grant usage on schema public to navelo_app, navelo_admin`)
  const [infos] = await sql`select rolname, rolbypassrls, rolsuper, rolcreaterole from pg_roles where rolname = 'navelo_app'`
  const [infoAdmin] = await sql`select rolname, rolbypassrls, rolsuper, rolcreaterole from pg_roles where rolname = 'navelo_admin'`
  console.log("conferência:", JSON.stringify([infos, infoAdmin]))
} finally {
  await sql.end()
}
