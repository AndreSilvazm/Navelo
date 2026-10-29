import { getSession, isCorporateRole } from "@/lib/auth/session"
import { getCollaboratorDetail } from "@/app/app/colaboradores/[id]/detail-data"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Dados do colaborador em JSON, consumidos (e cacheados) pelo navegador via TanStack Query
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !isCorporateRole(session.role)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { id } = await ctx.params
  if (!UUID.test(id)) return Response.json({ error: "Não encontrado" }, { status: 404 })

  const data = await getCollaboratorDetail(session.company.id, id, session.user.id)
  if (!data) return Response.json({ error: "Não encontrado" }, { status: 404 })

  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } })
}
