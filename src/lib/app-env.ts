// Em que ambiente esta cópia da aplicação está rodando. Sem dependências: é lido pelo proxy, pelo
// next.config e pelos componentes.
//
//   APP_ENV=production   produção (navelo.com.br)
//   APP_ENV=staging      homologação / teste (branch develop)
//   APP_ENV=development  máquina de quem desenvolve (padrão fora de produção)
//
// Produção precisa ser dita de forma explícita. Se APP_ENV faltar num servidor, o padrão é tratar
// como NÃO produção: aparece a tag de teste, os buscadores são barrados e os domínios de produção
// não são liberados. Esquecer a variável fica visível e inofensivo, em vez de silencioso e perigoso.
export type AppEnv = "development" | "staging" | "production"

const raw = process.env.APP_ENV?.trim().toLowerCase()

export const APP_ENV: AppEnv =
  raw === "production" || raw === "staging" || raw === "development" ? raw : process.env.NODE_ENV === "production" ? "staging" : "development"

export const IS_PRODUCTION = APP_ENV === "production"

/** Texto da tag fixa no site; vazio em produção */
export const ENV_TAG: string | null = IS_PRODUCTION ? null : APP_ENV === "staging" ? "Ambiente de teste" : "Desenvolvimento"

/** Domínios públicos de produção. Só são aceitos como origem quando APP_ENV=production. */
export const PRODUCTION_HOSTS = ["navelo.com.br", "www.navelo.com.br"]

const fromEnv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
    .filter(Boolean)

/**
 * Hosts que podem chamar a aplicação além do próprio (CORS e ações do servidor): os domínios de
 * produção (só em produção), o endereço do APP_URL e o que estiver em ALLOWED_ORIGINS.
 */
export function allowedHosts(): string[] {
  const appUrlHost = fromEnv(process.env.APP_URL)
  return [...new Set([...(IS_PRODUCTION ? PRODUCTION_HOSTS : []), ...appUrlHost, ...fromEnv(process.env.ALLOWED_ORIGINS)])]
}
