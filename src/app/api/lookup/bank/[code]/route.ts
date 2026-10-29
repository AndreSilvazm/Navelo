import { guardLookup } from "@/lib/api-guard"

// Nome do banco pelo código compensação (BrasilAPI). Só para quem está logado.
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const denied = await guardLookup()
  if (denied) return denied

  const { code } = await ctx.params
  if (!/^\d{3}$/.test(code)) return Response.json({ found: false, reason: "invalid" }, { status: 400 })

  try {
    const res = await fetch(`https://brasilapi.com.br/api/banks/v1/${Number(code)}`, {
      headers: { "User-Agent": "Navelo/1.0", Accept: "application/json" }, // sem User-Agent a BrasilAPI responde 403
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (res.status === 404) return Response.json({ found: false, reason: "not_found" })
    if (!res.ok) return Response.json({ found: false, reason: "unavailable" })

    const d = await res.json()
    return Response.json(
      { found: true, name: d.name ?? d.fullName ?? "" },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    )
  } catch {
    return Response.json({ found: false, reason: "unavailable" })
  }
}
