import { getSession } from "@/lib/auth/session"
import { isValidCnpj } from "@/lib/cnpj"
import { fetchCompanyProfile } from "@/lib/cnpj-lookup"

// Consulta pública de CNPJ (BrasilAPI), feita pelo servidor para preencher o cadastro.
// Só para quem está logado.
export async function GET(_req: Request, ctx: { params: Promise<{ cnpj: string }> }) {
  if (!(await getSession())) return Response.json({ error: "Não autorizado" }, { status: 401 })

  const { cnpj } = await ctx.params
  if (!isValidCnpj(cnpj)) return Response.json({ found: false, reason: "invalid" }, { status: 400 })

  const result = await fetchCompanyProfile(cnpj)
  if (result.status !== "ok") return Response.json({ found: false, reason: result.status })

  return Response.json({ found: true, ...result.data }, { headers: { "Cache-Control": "private, max-age=3600" } })
}
