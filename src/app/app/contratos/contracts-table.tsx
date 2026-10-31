"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { TableSearch, useTableSearch } from "@/components/table-search"
import { Badge, Icon } from "@/figma/ui"

export type ContractRow = {
  id: string
  name: string
  collaboratorId: string | null
  collaborator: string | null
  company: string | null
  cnpj: string | null // já formatado
  period: string
  startDate: string // AAAA-MM-DD, só para ordenar
  amount: string // já formatado, ou "A definir"
  amountCents: number | null
  statusLabel: string
  statusTone: "success" | "danger" | "warning" | "info" | "neutral"
}

const href = (id: string) => `/app/contratos/${id}`
const byText = (a?: string | null, b?: string | null) => (a ?? "").localeCompare(b ?? "", "pt-BR")

const columns: TableColumnsType<ContractRow> = [
  {
    title: "Colaborador",
    dataIndex: "collaborator",
    render: (nome: string | null, r) =>
      r.collaboratorId ? (
        <Link href={`/app/colaboradores/${r.collaboratorId}`} onClick={(e) => e.stopPropagation()}>
          <strong>{nome}</strong>
        </Link>
      ) : (
        <span className="form-hint">Sem colaborador</span>
      ),
    sorter: (a, b) => byText(a.collaborator, b.collaborator),
  },
  { title: "CNPJ", dataIndex: "cnpj", render: (cnpj: string | null) => <span style={{ whiteSpace: "nowrap" }}>{cnpj ?? "—"}</span> },
  { title: "Empresa", dataIndex: "company", render: (nome: string | null) => nome ?? "—" },
  { title: "Contrato", dataIndex: "name", render: (nome: string) => <strong>{nome}</strong>, sorter: (a, b) => byText(a.name, b.name) },
  {
    title: "Período",
    dataIndex: "period",
    render: (p: string) => <span style={{ whiteSpace: "nowrap" }}>{p}</span>,
    sorter: (a, b) => a.startDate.localeCompare(b.startDate),
  },
  {
    title: "Valor",
    dataIndex: "amount",
    align: "right",
    render: (v: string) => <span style={{ whiteSpace: "nowrap" }}>{v}</span>,
    sorter: (a, b) => (a.amountCents ?? -1) - (b.amountCents ?? -1),
  },
  { title: "Situação", dataIndex: "statusLabel", render: (_: string, r) => <Badge tone={r.statusTone}>{r.statusLabel}</Badge> },
  {
    title: "",
    key: "abrir",
    width: 48,
    render: (_: unknown, r) => (
      <Link aria-label={`Abrir o contrato ${r.name}`} href={href(r.id)} onClick={(e) => e.stopPropagation()}>
        <Icon name="chevron" size={16} />
      </Link>
    ),
  },
]

const searchParts = (r: ContractRow) => [r.collaborator, r.company, r.cnpj, r.name, r.period, r.statusLabel]

// Um contrato por linha, cada um ligado ao seu colaborador
export function ContractsTable({ rows }: { rows: ContractRow[] }) {
  const router = useRouter()
  const { query, setQuery, filtered } = useTableSearch(rows, searchParts)
  return (
    <>
      <TableSearch label="Buscar contratos" onChange={setQuery} placeholder="Buscar por colaborador, empresa, CNPJ ou contrato..." value={query} />
      <DataTable<ContractRow>
        columns={columns}
        dataSource={filtered}
        locale={{ emptyText: query ? `Nenhum contrato encontrado para “${query}”.` : "Nenhum contrato" }}
        onRow={(r) => ({ className: "row-link", onClick: () => router.push(href(r.id)) })}
        pagination={filtered.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
        rowKey="id"
        scroll={{ x: "max-content" }}
      />
    </>
  )
}
