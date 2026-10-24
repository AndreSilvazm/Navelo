// "João Silva" -> "JS"; "61.208.618 ANDRE SIMAO" -> "AS" (ignora números, comuns em razão social de MEI)
export function initialsOf(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
  if (parts.length === 0) return "?"
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "")
  return (first + last).toUpperCase()
}
