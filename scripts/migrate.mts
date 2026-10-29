/**
 * Aplica as migrações de estrutura no ambiente que estiver ATIVO no .env.local.
 *
 *   npm run db:migrate              # mostra o alvo e o que está pendente, pede confirmação
 *   npm run db:migrate -- --dry     # só mostra, não aplica nada
 *   npm run db:migrate -- --yes     # sem perguntar (nunca vale para produção)
 *
 * Como trocar de ambiente: no .env.local, comente o bloco que estava ligado e descomente o do
 * ambiente desejado (LOCAL, STAGING ou PRODUÇÃO). O bloco precisa ter DATABASE_MIGRATE_URL, a
 * conexão do DONO do banco, que é o único que altera estrutura.
 *
 * Migrações só andam para frente. Antes de aplicar em produção: aplique no staging primeiro,
 * teste, e confirme que existe backup recente do banco.
 */
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import postgres from "postgres"
import { LABEL, blockingProblems, loadActiveEnv, projectOf, readActiveEnv } from "./lib/active-env"

const apenasVer = process.argv.includes("--dry")
const semPerguntar = process.argv.includes("--yes")

const env = readActiveEnv()
const problemas = blockingProblems(env)
if (problemas.length > 0) {
  for (const p of problemas) console.error(`✗ ${p}`)
  process.exit(1)
}
if (env.appEnv === "production" && semPerguntar) {
  console.error("✗ --yes não vale para produção: a confirmação digitada é obrigatória.")
  process.exit(1)
}

loadActiveEnv()
// No LOCAL a conexão do app já é a do dono do banco. Em staging e produção, DATABASE_URL é o usuário
// sem privilégio (navelo_app), que não altera estrutura: lá a URL do dono precisa ser explícita.
const url = process.env.DATABASE_MIGRATE_URL || (env.appEnv === "development" ? process.env.DATABASE_URL : undefined)
if (!url) {
  console.error(
    `✗ O ambiente ativo (${env.appEnv}) não tem DATABASE_MIGRATE_URL.\n` +
      "  Descomente a linha DATABASE_MIGRATE_URL do bloco ativo: é a conexão do dono do banco (usuário postgres.<ref>).",
  )
  process.exit(1)
}

// mostra para onde vai, sem a senha
const projeto = projectOf(url)
console.log(`\nAmbiente:   ${LABEL[env.appEnv!]}`)
console.log(`Servidor:   ${projeto?.host}`)
console.log(`Projeto:    ${projeto?.ref}`)
console.log(`Usuário:    ${projeto?.user}`)

const sql = postgres(url, { max: 1 })

try {
  // pendentes: o mesmo critério do drizzle (data da migração maior que a última aplicada)
  const diario = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string; when: number }[] }
  const [existe] = await sql`select to_regclass('drizzle.__drizzle_migrations') as t`
  const aplicadas = existe.t ? await sql`select created_at from drizzle.__drizzle_migrations` : []
  const ultima = aplicadas.length ? Math.max(...aplicadas.map((r) => Number(r.created_at))) : -1
  const pendentes = diario.entries.filter((e) => e.when > ultima)

  console.log(`Aplicadas:  ${aplicadas.length} de ${diario.entries.length}`)
  if (pendentes.length === 0) {
    console.log("\nNada pendente: o banco já está em dia.")
    process.exit(0)
  }
  console.log(`\nPendentes (${pendentes.length}):`)
  for (const p of pendentes) console.log(`  • ${p.tag}`)

  if (apenasVer) {
    console.log("\n--dry: nada foi aplicado.")
    process.exit(0)
  }

  if (!semPerguntar) {
    if (!process.stdin.isTTY) {
      console.error("\n✗ Sem terminal interativo para confirmar. Rode num terminal, ou use --yes (nunca em produção).")
      process.exit(1)
    }
    const leitor = createInterface({ input: process.stdin, output: process.stdout })
    const producao = env.appEnv === "production"
    const esperado = producao ? "aplicar em producao" : "sim"
    const pergunta = producao
      ? `\nVocê está prestes a alterar a PRODUÇÃO. Backup recente? Já passou pelo staging?\nDigite "${esperado}" para continuar: `
      : `\nDigite "${esperado}" para aplicar: `
    const resposta = (await leitor.question(pergunta)).trim().toLowerCase()
    leitor.close()
    if (resposta !== esperado) {
      console.log("Cancelado. Nada foi aplicado.")
      process.exit(0)
    }
  }

  await migrate(drizzle(sql), { migrationsFolder: "drizzle" })
  const [{ n }] = await sql`select count(*)::int n from drizzle.__drizzle_migrations`
  console.log(`\nPronto. ${n} migrações aplicadas em ${LABEL[env.appEnv!]}.`)
} finally {
  await sql.end()
}
