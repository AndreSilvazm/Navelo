"use client"

import Link from "next/link"
import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { Badge, Icon } from "@/figma/ui"
import { invoiceStatusLabel, invoiceStatusTone, type InvoiceStatusValue } from "@/lib/invoice-status"

export type InvoiceRow = {
  id: string
  number: string
  collaborator: string
  company: string | null
  contract: string | null
  competence: string // já formatada (ex.: "mar/2026")
  competenceKey: string // AAAA-MM-DD, só para ordenar
  amount: string // já formatado em reais
  amountCents: number
  status: InvoiceStatusValue
  sentAt: string
  updatedAt: string
}

const href = (id: string) => `/app/notas-fiscais/${id}`
const byText = (a: string, b: string) => a.localeCompare(b, "pt-BR")

const columns: TableColumnsType<InvoiceRow> = [
  {
    title: "Nota",
    dataIndex: "number",
    render: (n: string, r) => (
      <Link href={href(r.id)}>
        <strong style={{ whiteSpace: "nowrap" }}>nº {n}</strong>
      </Link>
    ),
  },
  { title: "Colaborador", dataIndex: "collaborator", render: (nome: string) => <strong>{nome}</strong>, sorter: (a, b) => byText(a.collaborator, b.collaborator) },
  { title: "Empresa", dataIndex: "company", render: (nome: string | null) => nome ?? "—" },
  { title: "Contrato", dataIndex: "contract", render: (c: string | null) => c ?? "—" },
  { title: "Competência", dataIndex: "competence", sorter: (a, b) => a.competenceKey.localeCompare(b.competenceKey) },
  {
    title: "Valor",
    dataIndex: "amount",
    align: "right",
    render: (v: string) => <strong style={{ whiteSpace: "nowrap" }}>{v}</strong>,
    sorter: (a, b) => a.amountCents - b.amountCents,
  },
  { title: "Situação", dataIndex: "status", render: (s: InvoiceStatusValue) => <Badge tone={invoiceStatusTone[s]}>{invoiceStatusLabel[s]}</Badge> },
  { title: "Enviada em", dataIndex: "sentAt" },
  { title: "Atualizada em", dataIndex: "updatedAt" },
  {
    title: "",
    key: "abrir",
    width: 48,
    render: (_: unknown, r) => (
      <Link aria-label={`Abrir a nota nº ${r.number}`} href={href(r.id)}>
        <Icon name="chevron" size={16} />
      </Link>
    ),
  },
]

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  return (
    <DataTable<InvoiceRow>
      columns={columns}
      dataSource={rows}
      pagination={rows.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
      rowKey="id"
      scroll={{ x: "max-content" }}
    />
  )
}
