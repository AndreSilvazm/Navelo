import { getSession } from "@/lib/auth/session"

// Consulta pública de CEP (BrasilAPI), feita pelo servidor. Só para quem está logado.
export async function GET(_req: Request, ctx: { params: Promise<{ cep: string }> }) {
  if (!(await getSession())) return Response.json({ error: "Não autorizado" }, { status: 401 })

  const { cep } = await ctx.params
  if (!/^\d{8}$/.test(cep)) return Response.json({ found: false, reason: "invalid" }, { status: 400 })

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { "User-Agent": "Navelo/1.0", Accept: "application/json" }, // sem User-Agent a BrasilAPI responde 403
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (res.status === 404) return Response.json({ found: false, reason: "not_found" })
    if (!res.ok) return Response.json({ found: false, reason: "unavailable" })

    const d = await res.json()
    return Response.json(
      {
        found: true,
        street: d.street ?? "",
        district: d.neighborhood ?? "",
        city: d.city ?? "",
        state: d.state ?? "",
      },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    )
  } catch {
    return Response.json({ found: false, reason: "unavailable" })
  }
}
