/**
 * Lê o arquivo de variáveis (.env.local) e descobre QUAL ambiente está ativo.
 *
 * O arquivo guarda as chaves de todos os ambientes (local, staging, produção), cada bloco
 * comentado. Só o bloco descomentado vale. Como trocar de ambiente é comentar e descomentar à
 * mão, o erro clássico é deixar dois blocos ligados, ou esquecer a produção ligada. Estas
 * funções existem para pegar isso antes de a migração ou o servidor rodarem.
 */
import { config, parse } from "dotenv"
import { existsSync, readFileSync } from "node:fs"

export const ENV_FILE = process.env.ENV_FILE ?? ".env.local"

export type ActiveEnv = {
  file: string
  /** APP_ENV do bloco ativo; null se faltar */
  appEnv: "development" | "staging" | "production" | null
  /** chaves que aparecem ativas mais de uma vez (dois blocos ligados) */
  duplicates: string[]
  values: Record<string, string>
}

export function readActiveEnv(file = ENV_FILE): ActiveEnv {
  if (!existsSync(file)) throw new Error(`Não encontrei ${file}.`)
  const text = readFileSync(file, "utf8")

  // conta só linhas descomentadas no formato CHAVE=...
  const counts = new Map<string, number>()
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
  }
  const values = parse(text)
  const raw = values.APP_ENV?.trim().toLowerCase()
  return {
    file,
    appEnv: raw === "production" || raw === "staging" || raw === "development" ? raw : null,
    duplicates: [...counts].filter(([, n]) => n > 1).map(([k]) => k),
    values,
  }
}

/** Carrega o arquivo no process.env (as variáveis já definidas no terminal têm prioridade). */
export function loadActiveEnv(file = ENV_FILE) {
  config({ path: file, quiet: true })
}

export const LABEL: Record<string, string> = { development: "LOCAL (desenvolvimento)", staging: "STAGING (teste)", production: "PRODUÇÃO" }

/** Mensagens que impedem de continuar; vazio = pode seguir */
export function blockingProblems(env: ActiveEnv): string[] {
  const problems: string[] = []
  if (env.duplicates.length > 0) {
    problems.push(
      `Há mais de um bloco ligado: ${env.duplicates.join(", ")} aparece(m) descomentada(s) mais de uma vez em ${env.file}. ` +
        "Deixe só o bloco do ambiente que você quer e comente o resto.",
    )
  }
  if (!env.appEnv) problems.push(`${env.file} não tem APP_ENV ativo (development, staging ou production). Sem ele não dá para saber em que ambiente você está.`)
  return problems
}

/** Projeto do Supabase a partir do usuário do pooler (postgres.<ref>) */
export function projectOf(url: string | undefined): { user: string; ref: string; host: string } | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const user = decodeURIComponent(u.username)
    return { user, ref: user.split(".")[1] ?? "(sem ref)", host: `${u.hostname}:${u.port || 5432}` }
  } catch {
    return null
  }
}
