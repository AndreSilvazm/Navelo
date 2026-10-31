"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { TableSearch, useTableSearch } from "@/components/table-search"
import { Badge, Icon } from "@/figma/ui"
import { reimbursementStatusLabel, reimbursementStatusTone, type ReimbursementStatus } from "@/lib/reimbursements"

export type PortalReimbursementRow = {
  id: string
  expenseDate: string // AAAA-MM-DD, só para ordenar
  expenseDateLabel: string
  category: string // já em texto
  description: string
  merchant: string | null
  trip: string | null
  amount: string
  amountCents: number
  status: ReimbursementStatus
  receipts: number
  sentAt: string
}

const href = (id: string) => `/portal/reembolsos/${id}`

const columns: TableColumnsType<PortalReimbursementRow> = [
  { title: "Data", dataIndex: "expenseDateLabel", sorter: (a, b) => a.expenseDate.localeCompare(b.expenseDate), defaultSortOrder: "descend" },
  { title: "Categoria", dataIndex: "category" },
  { title: "Descrição", dataIndex: "description", render: (d: string) => <strong>{d}</strong> },
  { title: "Estabelecimento", dataIndex: "merchant", render: (m: string | null) => m ?? "—" },
  { title: "Viagem / projeto", dataIndex: "trip", render: (t: string | null) => t ?? "—" },
  {
    title: "Valor",
    dataIndex: "amount",
    align: "right",
    render: (v: string) => <strong style={{ whiteSpace: "nowrap" }}>{v}</strong>,
    sorter: (a, b) => a.amountCents - b.amountCents,
  },
  { title: "Situação", dataIndex: "status", render: (s: ReimbursementStatus) => <Badge tone={reimbursementStatusTone[s]}>{reimbursementStatusLabel[s]}</Badge> },
  { title: "Comprovantes", dataIndex: "receipts", align: "center" },
  { title: "Enviado em", dataIndex: "sentAt" },
  {
    title: "",
    key: "abrir",
    width: 48,
    render: (_: unknown, r) => (
      <Link aria-label="Abrir o pedido" href={href(r.id)} onClick={(e) => e.stopPropagation()}>
        <Icon name="chevron" size={16} />
      </Link>
    ),
  },
]

const searchParts = (r: PortalReimbursementRow) => [r.description, r.category, r.merchant, r.trip, reimbursementStatusLabel[r.status], r.amount, r.expenseDateLabel]

export function PortalReimbursementsTable({ rows }: { rows: PortalReimbursementRow[] }) {
  const router = useRouter()
  const { query, setQuery, filtered } = useTableSearch(rows, searchParts)
  return (
    <>
      <TableSearch label="Buscar reembolsos" onChange={setQuery} placeholder="Buscar por descrição, categoria, estabelecimento, viagem ou situação..." value={query} />
      <DataTable<PortalReimbursementRow>
        columns={columns}
        dataSource={filtered}
        locale={{ emptyText: query ? `Nenhum pedido encontrado para “${query}”.` : "Nenhum pedido" }}
        onRow={(r) => ({ className: "row-link", onClick: () => router.push(href(r.id)) })}
        rowKey="id"
        scroll={{ x: "max-content" }}
      />
    </>
  )
}
