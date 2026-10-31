import type postgres from "postgres"

/**
 * Tamanho do pool de conexões de cada cliente.
 *
 * Em hospedagem com várias instâncias, cada instância abre o seu pool. O pooler do banco tem
 * poucas vagas (15 no modo sessão), então pool grande demais por instância esgota tudo e as novas
 * conexões são recusadas ("max clients reached"). Isso vale para o modo sessão (porta 5432). No modo
 * RLS (staging e produção) a conexão é pelo pooler em modo TRANSAÇÃO (porta 6543), que aguenta
 * muito mais clientes, então o pool pode ser maior: medido com o servidor longe do banco, uma tela
 * de 8 consultas levou 3,9 s com pool de 3 e 1,3 s com pool de 10, porque as consultas rodam em
 * paralelo. As conexões ociosas fecham rápido. Em desenvolvimento, com uma instância só, pode ser maior.
 *
 *   DATABASE_POOL_MAX   força o tamanho do pool (opcional)
 */
export function poolOptions(kind: "app" | "admin"): postgres.Options<Record<string, never>> {
  const rlsMode = Boolean(process.env.DATABASE_ADMIN_URL)
  const forced = Number(process.env.DATABASE_POOL_MAX)
  const max = forced > 0 ? forced : rlsMode ? (kind === "app" ? 8 : 3) : kind === "app" ? 10 : 5
  return {
    max,
    // pooler em modo transação não aceita prepared statements
    prepare: false,
    // devolve ao pooler a conexão que ficou parada
    idle_timeout: 20,
    connect_timeout: 15,
  }
}
