import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { resolveDbContext, type DbContext } from "./context"
import { poolOptions } from "./pool"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { pg?: postgres.Sql }

// Reaproveita a conexão entre os hot reloads do `next dev`
const client = globalForDb.pg ?? postgres(process.env.DATABASE_URL!, poolOptions("app"))
if (process.env.NODE_ENV !== "production") globalForDb.pg = client

/**
 * Modo RLS: ligado quando existe DATABASE_ADMIN_URL, ou seja, quando DATABASE_URL é o usuário
 * `navelo_app`, que NÃO ignora as políticas. Aí toda consulta roda numa transação que antes
 * informa ao banco quem está agindo (usuário, empresa, papel), e as políticas decidem o que
 * aparece. Sem DATABASE_ADMIN_URL (desenvolvimento com o dono do banco) segue a conexão simples.
 */
const rlsMode = Boolean(process.env.DATABASE_ADMIN_URL)

const SETTINGS = `select set_config('app.user_id', $1, true), set_config('app.company_id', $2, true),
                         set_config('app.role', $3, true), set_config('app.membership_id', $4, true)`

const applyContext = (tx: postgres.Sql, ctx: DbContext | null) =>
  ctx ? tx.unsafe(SETTINGS, [ctx.userId, ctx.companyId, ctx.role, ctx.membershipId]) : Promise.resolve()

// Embrulha a conexão: o drizzle só usa `unsafe` (consulta avulsa) e `begin` (transação), e os dois
// passam a levar o contexto da sessão. `true` no set_config limita a configuração à transação,
// então nada vaza para a próxima pessoa que usar a mesma conexão do pool.
function scopeToSession(real: postgres.Sql): postgres.Sql {
  const inScope = async <T>(work: (tx: postgres.Sql) => Promise<T>): Promise<T> => {
    const ctx = await resolveDbContext()
    return real.begin(async (tx) => {
      const sql = tx as unknown as postgres.Sql
      // o contexto e a consulta seguem juntos pela mesma conexão, um logo depois do outro
      const [, result] = await Promise.all([applyContext(sql, ctx), work(sql)])
      return result
    }) as Promise<T>
  }

  return new Proxy(real, {
    get(target, prop) {
      if (prop === "unsafe") {
        return (query: string, params?: unknown[], options?: postgres.UnsafeQueryOptions) => {
          const run = (values: boolean) =>
            inScope(async (tx) => {
              const pending = tx.unsafe(query, params as never, options)
              return values ? await pending.values() : await pending
            })
          let plain: Promise<unknown> | undefined
          return {
            values: () => run(true),
            then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => (plain ??= run(false)).then(ok, fail),
            catch: (fail: (e: unknown) => unknown) => (plain ??= run(false)).catch(fail),
            finally: (done: () => void) => (plain ??= run(false)).finally(done),
          }
        }
      }
      if (prop === "begin") {
        return async (fn: (tx: postgres.Sql) => Promise<unknown>) => {
          const ctx = await resolveDbContext()
          return real.begin(async (tx) => {
            await applyContext(tx as unknown as postgres.Sql, ctx)
            return fn(tx as unknown as postgres.Sql)
          })
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

export const db = drizzle(rlsMode ? scopeToSession(client) : client, { schema })
