"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { TableSearch, useTableSearch } from "@/components/table-search"
import { Badge, Icon } from "@/figma/ui"
import { reimbursementStatusLabel, reimbursementStatusTone, type ReimbursementStatus } from "@/lib/reimbursements"

export type ReimbursementRow = {
  id: string
  cnpj: string | null // já formatado
  company: string | null
  collaboratorId: string
  collaborator: string
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

const href = (id: string) => `/app/reembolsos/${id}`
const byText = (a?: string | null, b?: string | null) => (a ?? "").localeCompare(b ?? "", "pt-BR")

const columns: TableColumnsType<ReimbursementRow> = [
  { title: "CNPJ", dataIndex: "cnpj", render: (cnpj: string | null) => <strong style={{ whiteSpace: "nowrap" }}>{cnpj ?? "—"}</strong>, sorter: (a, b) => byText(a.cnpj, b.cnpj) },
  { title: "Empresa", dataIndex: "company", render: (nome: string | null) => <strong>{nome ?? "—"}</strong>, sorter: (a, b) => byText(a.company, b.company) },
  {
    title: "Colaborador",
    dataIndex: "collaborator",
    render: (nome: string, r) => (
      <Link href={`/app/colaboradores/${r.collaboratorId}`} onClick={(e) => e.stopPropagation()}>
        {nome}
      </Link>
    ),
    sorter: (a, b) => byText(a.collaborator, b.collaborator),
  },
  { title: "Data", dataIndex: "expenseDateLabel", sorter: (a, b) => a.expenseDate.localeCompare(b.expenseDate), defaultSortOrder: "descend" },
  { title: "Categoria", dataIndex: "category" },
  { title: "Descrição", dataIndex: "description" },
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

const searchParts = (r: ReimbursementRow) => [
  r.cnpj,
  r.company,
  r.collaborator,
  r.description,
  r.category,
  r.merchant,
  r.trip,
  reimbursementStatusLabel[r.status],
  r.amount,
  r.expenseDateLabel,
]

export function ReimbursementsTable({ rows }: { rows: ReimbursementRow[] }) {
  const router = useRouter()
  const { query, setQuery, filtered } = useTableSearch(rows, searchParts)
  return (
    <>
      <TableSearch label="Buscar reembolsos" onChange={setQuery} placeholder="Buscar por CNPJ, empresa, colaborador, descrição, categoria ou viagem..." value={query} />
      <DataTable<ReimbursementRow>
        columns={columns}
        dataSource={filtered}
        locale={{ emptyText: query ? `Nenhum pedido encontrado para “${query}”.` : "Nenhum pedido nesta seção." }}
        onRow={(r) => ({ className: "row-link", onClick: () => router.push(href(r.id)) })}
        pagination={filtered.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
        rowKey="id"
        scroll={{ x: "max-content" }}
      />
    </>
  )
}
