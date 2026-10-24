import Link from "next/link"
import { TAB_LABELS, listHref, type Tab, type TabCounts } from "./types"

// Abas como links: usadas na tela de Convites (conteúdo renderizado no servidor).
// Na lista, as abas ficam dentro de CollaboratorsView, que troca sem recarregar.
export function CollaboratorTabs({ active, counts }: { active: Tab; counts: TabCounts }) {
  return (
    <nav aria-label="Seções de colaboradores" className="page-tabs">
      {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
        <Link aria-current={active === tab ? "page" : undefined} href={listHref({ aba: tab })} key={tab}>
          {TAB_LABELS[tab]}
          {tab !== "convites" && <span className="page-tab-count">{counts[tab]}</span>}
        </Link>
      ))}
    </nav>
  )
}
