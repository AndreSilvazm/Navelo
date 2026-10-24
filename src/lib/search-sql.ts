import "server-only"
import { sql, type AnyColumn, type SQL } from "drizzle-orm"

// Busca sem acento e sem diferenciar maiúsculas, feita no banco (sem precisar de extensão).
// Mesma normalização de src/lib/search.ts (cliente).
const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüçñ"
const PLAIN = "aaaaaeeeeiiiiooooouuuucn"

export const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&")

export const fold = (column: SQL | AnyColumn) => sql`translate(lower(coalesce(${column}, '')), ${ACCENTED}, ${PLAIN})`

// "a coluna contém o termo" (o termo já vem sem acento, de searchTerms)
export const containsTerm = (column: SQL | AnyColumn, term: string) => sql`${fold(column)} like ${`%${escapeLike(term)}%`}`
