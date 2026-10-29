/**
 * Mostra qual ambiente está ativo no .env.local e barra configuração perigosa.
 *
 *   npm run env:check          # só informa
 *   (roda sozinho antes do `npm run dev`, que recusa subir apontando para a produção)
 */
import { LABEL, ENV_FILE, blockingProblems, projectOf, readActiveEnv } from "./lib/active-env"

const paraDev = process.argv.includes("--dev")
const env = readActiveEnv()
const problemas = blockingProblems(env)

const url = env.values.DATABASE_MIGRATE_URL || env.values.DATABASE_URL
const projeto = projectOf(url)
console.log(`\nAmbiente ativo em ${ENV_FILE}: ${env.appEnv ? LABEL[env.appEnv] : "DESCONHECIDO"}`)
if (projeto) console.log(`Banco: projeto ${projeto.ref} (${projeto.host})`)

// usuário e porta de cada conexão (nunca a senha), com o que se espera em staging e produção
const esperado: Record<string, { usuario: string; porta: string }> = {
  DATABASE_URL: { usuario: "navelo_app", porta: "6543" },
  DATABASE_ADMIN_URL: { usuario: "navelo_admin", porta: "6543" },
  DATABASE_MIGRATE_URL: { usuario: "postgres", porta: "5432" },
}
if (env.appEnv === "staging" || env.appEnv === "production") {
  console.log("")
  for (const [chave, regra] of Object.entries(esperado)) {
    const info = projectOf(env.values[chave])
    if (!info) {
      console.log(`  ${chave.padEnd(22)} (não preenchida)`)
      continue
    }
    const usuario = info.user.split(".")[0]
    const porta = info.host.split(":")[1]
    const certo = usuario === regra.usuario && porta === regra.porta
    const aviso = certo ? "OK" : `ERRADO, o certo é usuário ${regra.usuario} e porta ${regra.porta}`
    console.log(`  ${chave.padEnd(22)} usuário ${usuario.padEnd(13)} porta ${porta}   ${aviso}`)
  }
}

if (problemas.length > 0) {
  for (const p of problemas) console.error(`\n✗ ${p}`)
  process.exit(1)
}
if (paraDev && env.appEnv === "production") {
  console.error("\n✗ O bloco de PRODUÇÃO está ativo e você está subindo o servidor de desenvolvimento.")
  console.error("  Isso conectaria o seu `npm run dev` ao banco de verdade. Comente a produção e ative o bloco LOCAL.")
  process.exit(1)
}
if (paraDev && env.appEnv === "staging") console.warn("\n⚠ O bloco de STAGING está ativo: o servidor local vai usar o banco de teste.")
console.log("")
