import "server-only"

/**
 * Cache curto em memória para consultas pesadas e repetidas (ex.: a visão geral). Reaproveita o
 * resultado por `ttlMs` e junta chamadas simultâneas na mesma consulta. A chave SEMPRE inclui a
 * empresa: nunca compartilhe resultado entre empresas. Quem chama roda o `load` dentro da própria
 * requisição, então o RLS continua valendo para quem pediu primeiro.
 */
const MAX_ENTRIES = 300
const store = new Map<string, { value: unknown; expires: number }>()
const inflight = new Map<string, Promise<unknown>>()

export async function ttlCached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const run = load()
    .then((value) => {
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!)
      store.set(key, { value, expires: Date.now() + ttlMs })
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, run)
  return run
}

/** Descarta o que foi guardado para uma chave (ou todas que começam com o prefixo) */
export function invalidateCached(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
}
