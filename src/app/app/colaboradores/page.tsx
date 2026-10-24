import type { Metadata } from "next"
import { PageHeading } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { CollaboratorInvites } from "./collaborator-invites"
import { CollaboratorsView } from "./collaborator-list"
import { CollaboratorTabs } from "./collaborator-tabs"
import { getCollaboratorListData, getTabCounts } from "./queries"
import { TABS, type Tab, type View } from "./types"

export const metadata: Metadata = { title: "Colaboradores" }

export default async function CollaboratorsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; q?: string; visao?: string }>
}) {
  const [session, params] = await Promise.all([requireSession("corporate"), searchParams])

  const aba: Tab = (TABS as readonly string[]).includes(params.aba ?? "") ? (params.aba as Tab) : "todos"
  const visao: View = params.visao === "cards" ? "cards" : "tabela"
  const q = (params.q ?? "").slice(0, 100)

  const heading = (
    <PageHeading
      subtitle="Acompanhe quem está em análise, quem está ativo e convide novos colaboradores."
      title="Colaboradores"
    />
  )

  if (aba === "convites") {
    return (
      <>
        {heading}
        <CollaboratorTabs active="convites" counts={await getTabCounts(session.company.id)} />
        <CollaboratorInvites />
      </>
    )
  }

  const data = await getCollaboratorListData(session.company.id, aba, q)
  return (
    <>
      {heading}
      <CollaboratorsView initial={{ aba, q, visao, data }} />
    </>
  )
}
