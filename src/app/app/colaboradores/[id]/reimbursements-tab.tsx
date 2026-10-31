"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { TableSearch, useTableSearch } from "@/components/table-search"
import { Badge, Card, Icon } from "@/figma/ui"
import { formatBRL, formatDate } from "@/lib/format"
import { categoryLabel, reimbursementStatusLabel, reimbursementStatusTone, type ReimbursementStatus } from "@/lib/reimbursements"
import type { CollaboratorDetailData } from "./types"

type Row = {
  id: string
  expenseDate: string
  expenseDateLabel: string
  category: string
  description: string
  amount: string
  amountCents: number
  status: ReimbursementStatus
  sentAt: string
}

const href = (id: string) => `/app/reembolsos/${id}`

const columns: TableColumnsType<Row> = [
  { title: "Data", dataIndex: "expenseDateLabel", sorter: (a, b) => a.expenseDate.localeCompare(b.expenseDate), defaultSortOrder: "descend" },
  { title: "Categoria", dataIndex: "category" },
  { title: "Descrição", dataIndex: "description", render: (d: string) => <strong>{d}</strong> },
  {
    title: "Valor",
    dataIndex: "amount",
    align: "right",
    render: (v: string) => <strong style={{ whiteSpace: "nowrap" }}>{v}</strong>,
    sorter: (a, b) => a.amountCents - b.amountCents,
  },
  { title: "Situação", dataIndex: "status", render: (s: ReimbursementStatus) => <Badge tone={reimbursementStatusTone[s]}>{reimbursementStatusLabel[s]}</Badge> },
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

const searchParts = (r: Row) => [r.description, r.category, reimbursementStatusLabel[r.status], r.amount, r.expenseDateLabel]

// Reembolsos do colaborador. Cada pedido abre a própria página, onde a empresa confere os
// comprovantes e decide (aprovar, recusar ou marcar como pago).
export function ReimbursementsTab({ data }: { data: CollaboratorDetailData }) {
  const router = useRouter()
  const list = data.reimbursements
  const sum = (s: string) => list.filter((r) => r.status === s).reduce((t, r) => t + r.amountCents, 0)
  const count = (s: string) => list.filter((r) => r.status === s).length

  const rows = useMemo<Row[]>(
    () =>
      list.map((r) => ({
        id: r.id,
        expenseDate: r.expenseDate,
        expenseDateLabel: formatDate(r.expenseDate),
        category: categoryLabel(r.category),
        description: r.description,
        amount: formatBRL(r.amountCents),
        amountCents: r.amountCents,
        status: r.status,
        sentAt: new Date(r.createdAt).toLocaleDateString("pt-BR"),
      })),
    [list],
  )
  const { query, setQuery, filtered } = useTableSearch(rows, searchParts)

  return (
    <div className="dash">
      <div className="dash-kpis">
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em revisão</span>
          <strong>{count("submitted")}</strong>
          <small>{formatBRL(sum("submitted"))} aguardando você</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovados, a pagar</span>
          <strong>{formatBRL(sum("approved"))}</strong>
          <small>{count("approved")} pedido(s)</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Pagos</span>
          <strong>{formatBRL(sum("paid"))}</strong>
          <small>{count("paid")} pedido(s)</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Recusados</span>
          <strong>{count("rejected")}</strong>
          <small>{formatBRL(sum("rejected"))}</small>
        </div>
      </div>

      <Card className="workspace-table-card">
        {list.length === 0 ? (
          <p className="form-hint" style={{ padding: 24 }}>
            Este colaborador ainda não pediu reembolso.
          </p>
        ) : (
          <>
            <TableSearch label="Buscar reembolsos do colaborador" onChange={setQuery} placeholder="Buscar por descrição, categoria, valor ou situação..." value={query} />
            <DataTable<Row>
              columns={columns}
              dataSource={filtered}
              locale={{ emptyText: query ? `Nenhum pedido encontrado para “${query}”.` : "Nenhum pedido" }}
              onRow={(r) => ({ className: "row-link", onClick: () => router.push(href(r.id)) })}
              pagination={filtered.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
              rowKey="id"
              scroll={{ x: "max-content" }}
            />
          </>
        )}
      </Card>
      <p className="form-hint">
        Os custos, a comparação com o normal e a projeção do próximo mês estão na aba <strong>Dashboard</strong>.
      </p>
    </div>
  )
}
