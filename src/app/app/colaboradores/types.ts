// Tipos e constantes compartilhados entre o servidor e a lista (componente de cliente).
import type { CollaboratorStatus } from "@/db/schema"

export const TABS = ["todos", "revisao", "ativos", "cadastro", "suspensos", "recusados", "convites"] as const
export type Tab = (typeof TABS)[number]
export type View = "tabela" | "cards"

export const TAB_LABELS: Record<Tab, string> = {
  todos: "Todos",
  revisao: "Em revisão",
  ativos: "Ativos",
  cadastro: "Em cadastro",
  suspensos: "Suspensos",
  recusados: "Recusados",
  convites: "Convites",
}

export const TAB_STATUSES: Record<Exclude<Tab, "todos" | "convites">, CollaboratorStatus[]> = {
  revisao: ["in_review"],
  ativos: ["active"],
  cadastro: ["profile_pending", "documents_pending"],
  suspensos: ["suspended"],
  recusados: ["rejected"],
}

export const statusLabel: Record<CollaboratorStatus, string> = {
  profile_pending: "Preenchendo dados",
  documents_pending: "Enviando documentos",
  in_review: "Em revisão",
  active: "Ativo",
  rejected: "Acesso recusado",
  suspended: "Acesso suspenso",
}
export const statusTone = {
  profile_pending: "neutral",
  documents_pending: "warning",
  in_review: "info",
  active: "success",
  rejected: "danger",
  suspended: "warning",
} as const

// Apenas dados simples (JSON): trafega pela API e pelo cache do navegador
export type CollaboratorRow = {
  id: string
  status: CollaboratorStatus
  name: string
  email: string
  legalName: string | null
  tradeName: string | null
  jobTitle: string | null
  cnpj: string | null
  docsApproved: number
  docsRequired: number
}

export type TabCounts = Record<"todos" | "revisao" | "ativos" | "cadastro" | "suspensos" | "recusados", number>

export type CollaboratorListData = { rows: CollaboratorRow[]; counts: TabCounts }

// Monta a URL da lista preservando aba, busca e modo de visualização
export function listHref(p: { aba?: Tab; q?: string; visao?: View }) {
  const params = new URLSearchParams()
  if (p.aba && p.aba !== "todos") params.set("aba", p.aba)
  if (p.q) params.set("q", p.q)
  if (p.visao && p.visao !== "tabela") params.set("visao", p.visao)
  const qs = params.toString()
  return qs ? `/app/colaboradores?${qs}` : "/app/colaboradores"
}
