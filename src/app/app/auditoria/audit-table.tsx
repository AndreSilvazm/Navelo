"use client"

import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/figma/ui"
import { LABEL } from "./audit-labels"

export type AuditRow = {
  id: string
  when: string // data já formatada no servidor (evita diferença de fuso entre servidor e navegador)
  createdAt: string // ISO, só para ordenar
  actorName: string | null
  actorRole: string | null
  action: string
  targetLabel: string | null
  details: unknown
  ipAddress: string | null
}


// Mostra o conteúdo de "details" de um jeito legível, inclusive o de/para da conta bancária
function Detalhes({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null
  const obj = details as Record<string, unknown>
  const texto = (valor: unknown): string => {
    if (valor === null || valor === undefined) return "—"
    if (typeof valor === "object") {
      return Object.entries(valor as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ")
    }
    return String(valor)
  }
  const linhas = Object.entries(obj).filter(([k]) => k !== "colaboradorId")
  if (linhas.length === 0) return null
  return (
    <ul className="audit-details">
      {linhas.map(([chave, valor]) => (
        <li key={chave}>
          <b>{chave === "de" ? "De" : chave === "para" ? "Para" : chave}:</b> {texto(valor)}
        </li>
      ))}
    </ul>
  )
}

const columns: TableColumnsType<AuditRow> = [
  {
    title: "Quando",
    dataIndex: "when",
    render: (when: string) => <span style={{ whiteSpace: "nowrap" }}>{when}</span>,
    sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
  },
  { title: "Quem", dataIndex: "actorName", render: (nome: string | null) => <strong>{nome ?? "—"}</strong> },
  { title: "Papel", dataIndex: "actorRole", render: (papel: string | null) => papel ?? "—" },
  {
    title: "Ação",
    dataIndex: "action",
    render: (action: string) => {
      const rotulo = LABEL[action] ?? { text: action, tone: "neutral" as const }
      return <Badge tone={rotulo.tone}>{rotulo.text}</Badge>
    },
  },
  { title: "Sobre", dataIndex: "targetLabel", render: (alvo: string | null) => alvo ?? "—" },
  { title: "Detalhes", dataIndex: "details", render: (details: unknown) => <Detalhes details={details} /> },
  { title: "IP", dataIndex: "ipAddress", render: (ip: string | null) => <span style={{ whiteSpace: "nowrap" }}>{ip ?? "—"}</span> },
]

// A paginação continua no servidor (links "Mais recentes / Mais antigos"): a tabela só mostra a página recebida.
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return <DataTable<AuditRow> columns={columns} dataSource={rows} pagination={false} rowKey="id" scroll={{ x: "max-content" }} />
}
