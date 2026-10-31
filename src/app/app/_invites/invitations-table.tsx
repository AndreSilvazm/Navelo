"use client"

import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { TableSearch, useTableSearch } from "@/components/table-search"
import { Badge, Button } from "@/figma/ui"
import { resendInvitation, revokeInvitation } from "./actions"

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired"

export type InviteRow = {
  id: string
  email: string
  role: string // cargo ou papel, já em texto
  sentAt: string
  sentBy: string | null
  status: InviteStatus
  deadline: string
}

const label: Record<InviteStatus, string> = { pending: "Pendente", accepted: "Aceito", revoked: "Cancelado", expired: "Expirado" }
const tone = { pending: "warning", accepted: "success", revoked: "neutral", expired: "danger" } as const

const columns: TableColumnsType<InviteRow> = [
  { title: "E-mail", dataIndex: "email", render: (email: string) => <strong>{email}</strong> },
  { title: "Cargo", dataIndex: "role" },
  { title: "Enviado em", dataIndex: "sentAt" },
  { title: "Enviado por", dataIndex: "sentBy", render: (nome: string | null) => nome ?? "—" },
  { title: "Situação", dataIndex: "status", render: (s: InviteStatus) => <Badge tone={tone[s]}>{label[s]}</Badge> },
  { title: "Prazo", dataIndex: "deadline" },
  {
    title: "",
    key: "acoes",
    render: (_: unknown, r) => (
      <div className="invite-actions">
        {(r.status === "pending" || r.status === "expired") && (
          <form action={resendInvitation.bind(null, r.id)}>
            <Button type="submit" variant="secondary">
              Reenviar
            </Button>
          </form>
        )}
        {r.status === "pending" && (
          <form action={revokeInvitation.bind(null, r.id)}>
            <Button type="submit" variant="ghost">
              Cancelar
            </Button>
          </form>
        )}
      </div>
    ),
  },
]

const searchParts = (r: InviteRow) => [r.email, r.role, r.sentBy, label[r.status], r.sentAt]

export function InvitationsTable({ rows }: { rows: InviteRow[] }) {
  const { query, setQuery, filtered } = useTableSearch(rows, searchParts)
  return (
    <>
      <TableSearch label="Buscar convites" onChange={setQuery} placeholder="Buscar por e-mail, cargo ou quem enviou..." value={query} />
      <DataTable<InviteRow>
        columns={columns}
        dataSource={filtered}
        locale={{ emptyText: query ? `Nenhum convite encontrado para “${query}”.` : "Nenhum convite" }}
        pagination={filtered.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
        rowKey="id"
        scroll={{ x: "max-content" }}
      />
    </>
  )
}
