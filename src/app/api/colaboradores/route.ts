import { getSession, isCorporateRole } from "@/lib/auth/session"
import { getCollaboratorListData } from "@/app/app/colaboradores/queries"
import { TABS, type Tab } from "@/app/app/colaboradores/types"

// Lista de colaboradores em JSON, consumida (e cacheada) pelo navegador via TanStack Query
export async function GET(req: Request) {
  const session = await getSession()
  if (!session || !isCorporateRole(session.role)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 })
  }

  const params = new URL(req.url).searchParams
  const aba = params.get("aba") ?? "todos"
  const tab: Tab = (TABS as readonly string[]).includes(aba) && aba !== "convites" ? (aba as Tab) : "todos"
  const q = (params.get("q") ?? "").slice(0, 100)

  const data = await getCollaboratorListData(session.company.id, tab, q)
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } })
}
