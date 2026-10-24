import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth/session"
import { CollaboratorDetail, type DetailTab } from "./collaborator-detail"
import { getCollaboratorDetail } from "./detail-data"

export const metadata: Metadata = { title: "Colaborador" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TABS: DetailTab[] = ["andamento", "dashboard", "geral", "documentos", "bancarios", "notas"]

// Só a primeira carga passa pelo servidor. Depois, abas e documentos vêm do cache do
// navegador (TanStack Query), sem nova ida ao banco enquanto o dado estiver fresco.
export default async function CollaboratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const [session, { id }, { aba }] = await Promise.all([requireSession("corporate"), params, searchParams])
  if (!UUID.test(id)) notFound()

  const data = await getCollaboratorDetail(session.company.id, id)
  if (!data) notFound()

  // sem aba na URL abre o andamento; notas fiscais só para colaborador ativo
  const requested = TABS.find((t) => t === aba) ?? "andamento"
  const tab = requested === "notas" && data.status !== "active" ? "andamento" : requested
  return <CollaboratorDetail data={data} tab={tab} />
}
