import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaborators } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"
import { getCnpjReport } from "@/lib/cnpj-report"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Consulta pública do CNPJ do colaborador (Receita Federal) + alertas.
// `?fresh=1` ignora o cache do servidor.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !isCorporateRole(session.role)) return Response.json({ error: "Não autorizado" }, { status: 401 })

  const { id } = await ctx.params
  if (!UUID.test(id)) return Response.json({ error: "Não encontrado" }, { status: 404 })

  const [c] = await db
    .select({ cnpj: collaborators.cnpj, legalName: collaborators.legalName, zipCode: collaborators.zipCode })
    .from(collaborators)
    .where(and(eq(collaborators.id, id), eq(collaborators.companyId, session.company.id)))
  if (!c) return Response.json({ error: "Não encontrado" }, { status: 404 })

  const fresh = new URL(req.url).searchParams.has("fresh")
  const data = await getCnpjReport(c.cnpj, { legalName: c.legalName, zipCode: c.zipCode }, fresh)
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } })
}
