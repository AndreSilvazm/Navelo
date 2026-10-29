import type postgres from "postgres"

/**
 * Tamanho do pool de conexões de cada cliente.
 *
 * Em hospedagem com várias instâncias, cada instância abre o seu pool. O pooler do banco tem
 * poucas vagas (15 no modo sessão), então pool grande demais por instância esgota tudo e as novas
 * conexões são recusadas ("max clients reached"). Por isso, no modo RLS (staging e produção) o
 * pool é pequeno e as conexões ociosas fecham rápido. Em desenvolvimento, com uma instância só,
 * pode ser maior.
 *
 *   DATABASE_POOL_MAX   força o tamanho do pool (opcional)
 */
export function poolOptions(kind: "app" | "admin"): postgres.Options<Record<string, never>> {
  const rlsMode = Boolean(process.env.DATABASE_ADMIN_URL)
  const forced = Number(process.env.DATABASE_POOL_MAX)
  const max = forced > 0 ? forced : rlsMode ? (kind === "app" ? 3 : 2) : kind === "app" ? 10 : 5
  return {
    max,
    // pooler em modo transação não aceita prepared statements
    prepare: false,
    // devolve ao pooler a conexão que ficou parada
    idle_timeout: 20,
    connect_timeout: 15,
  }
}
