import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/**
 * Conexão de SISTEMA (`navelo_admin`): ignora o RLS e só faz DML, sem alterar estrutura.
 *
 * Use apenas onde não existe sessão ou onde a operação atravessa empresas por natureza:
 * login, convite, troca de senha, sessões, limite de tentativas e auditoria. Todo o resto da
 * aplicação usa `db` (src/db/index.ts), que fica sujeito às políticas de RLS.
 *
 * Em desenvolvimento, sem DATABASE_ADMIN_URL, cai na mesma conexão do `db`.
 */
const globalForDb = globalThis as unknown as { pgAdmin?: postgres.Sql }

const client = globalForDb.pgAdmin ?? postgres((process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL)!, { max: 5 })
if (process.env.NODE_ENV !== "production") globalForDb.pgAdmin = client

export const dbAdmin = drizzle(client, { schema })
