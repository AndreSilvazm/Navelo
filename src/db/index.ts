import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { resolveDbContext } from "./context"
import { poolOptions } from "./pool"
import * as schema from "./schema"
import { scopeToSession } from "./scope"

const globalForDb = globalThis as unknown as { pg?: postgres.Sql }

// Reaproveita a conexão entre os hot reloads do `next dev`
const client = globalForDb.pg ?? postgres(process.env.DATABASE_URL!, poolOptions("app"))
if (process.env.NODE_ENV !== "production") globalForDb.pg = client

/**
 * Modo RLS: ligado quando existe DATABASE_ADMIN_URL, ou seja, quando DATABASE_URL é o usuário
 * `navelo_app`, que NÃO ignora as políticas. Aí toda consulta roda numa transação que antes
 * informa ao banco quem está agindo (usuário, empresa, papel), e as políticas decidem o que
 * aparece (ver src/db/scope.ts). Sem DATABASE_ADMIN_URL (desenvolvimento com o dono do banco)
 * segue a conexão simples.
 */
const rlsMode = Boolean(process.env.DATABASE_ADMIN_URL)

export const db = drizzle(rlsMode ? scopeToSession(client, resolveDbContext) : client, { schema })
