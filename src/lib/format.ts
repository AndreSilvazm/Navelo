// "2026-01-31" -> "31/01/2026" (sem passar por Date, para não deslocar pelo fuso)
export const formatDate = (iso: string) => iso.split("-").reverse().join("/")

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// "1.234,56" -> 123456 (centavos); vazio -> null; inválido -> NaN
export function parseBRLToCents(value: string) {
  const clean = value.trim()
  if (!clean) return null
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return NaN
  return Math.round(parseFloat(clean.replace(/\./g, "").replace(",", ".")) * 100)
}

export const formatInvoiceDue = (day: number | null) => (day ? `Até o dia ${day} de cada mês` : "Sem prazo definido")

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e"])

// "AVENIDA PAULISTA" -> "Avenida Paulista"; "SN" -> "S/N"
export function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (word === "sn" ? "S/N" : i > 0 && LOWER_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
}
