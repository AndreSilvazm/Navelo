import logos from "@/lib/bank-logos.json"

const byCode = logos as Record<string, string>

// "ITAÚ UNIBANCO S.A." -> "IU"; usado quando o banco não tem logo
function initials(name?: string) {
  const words = (name ?? "").replace(/\b(banco|bco|s\.?a\.?)\b/gi, "").split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase()
}

// Logo do banco pelo código de compensação (padrão da plataforma para identificar a instituição).
// Sem logo cadastrado, mostra as iniciais. Uso nominativo: veja public/banks/AVISO.md.
export function BankLogo({ code, name, size = 28 }: { code?: string | null; name?: string | null; size?: number }) {
  const file = code ? byCode[code] : undefined

  if (file) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" className="bank-logo" height={size} src={`/banks/${file}.png`} width={size} />
    )
  }
  return (
    <span aria-hidden="true" className="bank-logo bank-logo-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials(name ?? undefined)}
    </span>
  )
}
