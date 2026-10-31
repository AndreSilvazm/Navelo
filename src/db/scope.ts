import type postgres from "postgres"

export type DbContext = { userId: string; companyId: string; role: string; membershipId: string }

/**
 * Cada consulta com RLS precisa dizer ao banco quem está agindo. Cada ida e volta ao banco custa
 * tempo (e custa muito quando o servidor está longe dele), então o desenho aqui é: poucas viagens.
 *
 * ATENÇÃO À SEGURANÇA — leia antes de mexer:
 * - O texto do contexto é montado por concatenação (não por parâmetro) para caber numa viagem só.
 *   Isso só é seguro porque CADA valor passa por uma lista de permissão estrita (UUID ou um dos
 *   papéis conhecidos) antes de entrar no texto. Valor fora do padrão derruba a consulta.
 * - Os valores da CONSULTA (busca digitada, filtros, ids vindos da URL...) continuam sendo
 *   parâmetros ($1, $2...), enviados à parte e nunca lidos como SQL. Nunca embuta esses valores
 *   no texto: um valor malicioso poderia fechar a consulta e rodar um `set_config` para trocar
 *   de empresa, o que acabaria com o isolamento entre empresas.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = new Set(["owner", "admin", "agent", "collaborator"])

function literal(value: string, ok: (v: string) => boolean, name: string) {
  if (typeof value !== "string" || !ok(value)) throw new Error(`Contexto de banco inválido (${name})`)
  return `'${value}'` // só chega aqui UUID ou papel conhecido: não há aspas nem caractere especial
}

/** `select set_config(...)` com o contexto. O `true` limita o valor à transação: nada vaza para o próximo uso da conexão. */
export function contextSql(ctx: DbContext): string {
  return (
    `select set_config('app.user_id', ${literal(ctx.userId, (v) => UUID.test(v), "usuário")}, true), ` +
    `set_config('app.company_id', ${literal(ctx.companyId, (v) => UUID.test(v), "empresa")}, true), ` +
    `set_config('app.role', ${literal(ctx.role, (v) => ROLES.has(v), "papel")}, true), ` +
    `set_config('app.membership_id', ${literal(ctx.membershipId, (v) => UUID.test(v), "vínculo")}, true)`
  )
}

/**
 * Manda o contexto para dentro de uma transação já aberta. Devolve a promessa JÁ DISPARADA: o
 * postgres-js só envia uma consulta quando alguém a "aguarda" (ou chama .execute()), então sem o
 * execute() o set_config só sairia DEPOIS da consulta real e ela rodaria sem contexto, com o RLS
 * devolvendo zero linhas. Como as consultas vão na mesma conexão e em ordem, quem dispara isto
 * primeiro e a consulta logo depois não precisa esperar a resposta do contexto.
 */
export function applyContext(tx: postgres.Sql, ctx: DbContext | null): Promise<unknown> {
  if (!ctx) return Promise.resolve()
  return tx.unsafe(contextSql(ctx)).simple().execute()
}

/**
 * Embrulha a conexão: o drizzle só usa `unsafe` (consulta avulsa) e `begin` (transação), e os dois
 * passam a levar o contexto da sessão. `resolve` diz quem está agindo; vem do cookie da sessão.
 *
 * - Consulta avulsa: BEGIN, depois contexto e consulta juntos, depois COMMIT (4 idas e voltas em vez de 6).
 * - Transação (`db.transaction`): o contexto sai junto com as consultas da transação.
 *
 * Medido (servidor a ~120 ms do banco): consulta com RLS 741 ms -> 495 ms. Juntar várias consultas
 * de uma tela numa transação só NÃO ajuda: numa conexão o driver executa uma consulta por vez, e
 * ficou mais lento que consultas paralelas em conexões diferentes. Para telas com muitas consultas
 * o ganho vem de pool maior (paralelismo), menos consultas e cache.
 */
export function scopeToSession(real: postgres.Sql, resolve: () => Promise<DbContext | null>): postgres.Sql {
  const single = async (query: string, params: unknown[] | undefined, options: postgres.UnsafeQueryOptions | undefined, values: boolean) => {
    const ctx = await resolve()
    // transação normal do driver (BEGIN, trabalho, COMMIT); o contexto e a consulta saem juntos, em
    // ordem, na mesma conexão. (Não usar `reserve()`: sob concorrência o pool do driver deixava
    // conexões presas, o que travava o app.)
    return real.begin(async (tx) => {
      const sql = tx as unknown as postgres.Sql
      const pending = sql.unsafe(query, params as never, options)
      const [, result] = await Promise.all([applyContext(sql, ctx), values ? pending.values() : pending])
      return result
    })
  }

  return new Proxy(real, {
    get(target, prop) {
      if (prop === "unsafe") {
        return (query: string, params?: unknown[], options?: postgres.UnsafeQueryOptions) => {
          let plain: Promise<unknown> | undefined
          return {
            values: () => single(query, params, options, true),
            then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => (plain ??= single(query, params, options, false)).then(ok, fail),
            catch: (fail: (e: unknown) => unknown) => (plain ??= single(query, params, options, false)).catch(fail),
            finally: (done: () => void) => (plain ??= single(query, params, options, false)).finally(done),
          }
        }
      }
      if (prop === "begin") {
        return async (fn: (tx: postgres.Sql) => Promise<unknown>) => {
          const ctx = await resolve()
          return real.begin(async (tx) => {
            const sql = tx as unknown as postgres.Sql
            // o contexto vai na frente, sem esperar a resposta: a ordem da conexão garante que
            // ele é aplicado antes das consultas que a transação dispara em seguida
            // (Promise.all dispara o contexto primeiro e não deixa nenhuma das duas sem tratamento)
            const [, result] = await Promise.all([applyContext(sql, ctx), fn(sql)])
            return result
          })
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
