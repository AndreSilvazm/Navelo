"use client"

import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { TableSearch, useTableSearch } from "@/components/table-search"
import { Badge } from "@/figma/ui"
import { invoiceStatusLabel, invoiceStatusTone, type InvoiceStatusValue } from "@/lib/invoice-status"

export type PortalInvoiceRow = {
  id: string
  number: string
  competence: string // já formatada
  competenceKey: string // só para ordenar
  description: string | null
  rejectionNote: string | null // motivo da recusa (só nas recusadas)
  contract: string | null
  amount: string
  amountCents: number
  status: InvoiceStatusValue
  sentAt: string
  updatedAt: string
}

const columns: TableColumnsType<PortalInvoiceRow> = [
  { title: "Competência", dataIndex: "competence", sorter: (a, b) => a.competenceKey.localeCompare(b.competenceKey) },
  { title: "Nota", dataIndex: "number", render: (n: string) => <strong style={{ whiteSpace: "nowrap" }}>nº {n}</strong> },
  { title: "Descrição", dataIndex: "description", render: (d: string | null) => d ?? "—" },
  { title: "Contrato", dataIndex: "contract", render: (c: string | null) => c ?? "—" },
  {
    title: "Valor",
    dataIndex: "amount",
    align: "right",
    render: (v: string) => <span style={{ whiteSpace: "nowrap" }}>{v}</span>,
    sorter: (a, b) => a.amountCents - b.amountCents,
  },
  { title: "Situação", dataIndex: "status", render: (s: InvoiceStatusValue) => <Badge tone={invoiceStatusTone[s]}>{invoiceStatusLabel[s]}</Badge> },
  { title: "Motivo da recusa", dataIndex: "rejectionNote", render: (m: string | null) => m ?? "—" },
  { title: "Enviada em", dataIndex: "sentAt" },
  { title: "Atualizada em", dataIndex: "updatedAt" },
  {
    title: "",
    key: "ver",
    render: (_: unknown, r) => (
      <a className="doc-review-next" href={`/api/notas/${r.id}/arquivo`} rel="noreferrer" target="_blank">
        Ver nota
      </a>
    ),
  },
]

const searchParts = (r: PortalInvoiceRow) => [r.number, r.competence, r.description, r.contract, invoiceStatusLabel[r.status], r.amount]

export function PortalInvoicesTable({ rows }: { rows: PortalInvoiceRow[] }) {
  const { query, setQuery, filtered } = useTableSearch(rows, searchParts)
  return (
    <>
      <TableSearch label="Buscar notas" onChange={setQuery} placeholder="Buscar por nº da nota, competência, contrato ou situação..." value={query} />
      <DataTable<PortalInvoiceRow>
        columns={columns}
        dataSource={filtered}
        locale={{ emptyText: query ? `Nenhuma nota encontrada para “${query}”.` : "Nenhuma nota" }}
        pagination={filtered.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
        rowKey="id"
        scroll={{ x: "max-content" }}
      />
    </>
  )
}
