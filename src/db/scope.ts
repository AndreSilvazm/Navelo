import type postgres from "postgres"

export type DbContext = { userId: string; companyId: string; role: string; membershipId: string }

const SETTINGS = `select set_config('app.user_id', $1, true), set_config('app.company_id', $2, true),
                         set_config('app.role', $3, true), set_config('app.membership_id', $4, true)`

/**
 * Manda o contexto (quem está agindo) para dentro da transação. Devolve a promessa JÁ DISPARADA:
 * o postgres-js só envia uma consulta quando alguém a "aguarda" (ou chama .execute()), então sem o
 * execute() o set_config só sairia DEPOIS da consulta real e ela rodaria sem contexto, com o RLS
 * devolvendo zero linhas. `true` no set_config limita o valor à transação: nada vaza para a próxima
 * pessoa que usar a mesma conexão do pool.
 */
export function applyContext(tx: postgres.Sql, ctx: DbContext | null): Promise<unknown> {
  if (!ctx) return Promise.resolve()
  return tx.unsafe(SETTINGS, [ctx.userId, ctx.companyId, ctx.role, ctx.membershipId]).execute()
}

/**
 * Embrulha a conexão: o drizzle só usa `unsafe` (consulta avulsa) e `begin` (transação), e os dois
 * passam a levar o contexto da sessão. `resolve` diz quem está agindo; vem do cookie da sessão.
 */
export function scopeToSession(real: postgres.Sql, resolve: () => Promise<DbContext | null>): postgres.Sql {
  const inScope = async <T>(work: (tx: postgres.Sql) => Promise<T>): Promise<T> => {
    const ctx = await resolve()
    return real.begin(async (tx) => {
      const sql = tx as unknown as postgres.Sql
      // o contexto é enviado primeiro e a consulta logo depois, na mesma conexão e na ordem certa
      const setting = applyContext(sql, ctx)
      const result = work(sql)
      await setting
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
          const ctx = await resolve()
          return real.begin(async (tx) => {
            // aqui o contexto é aguardado antes de qualquer consulta da transação
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
