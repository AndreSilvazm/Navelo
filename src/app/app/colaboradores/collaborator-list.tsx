"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type TableColumnsType } from "antd"
import { DataTable } from "@/components/data-table"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Avatar, Badge, Card, Icon } from "@/figma/ui"
import { formatCnpj } from "@/lib/cnpj"
import { initialsOf } from "@/lib/initials"
import {
  TAB_LABELS,
  listHref,
  statusLabel,
  statusTone,
  type CollaboratorListData,
  type CollaboratorRow,
  type Tab,
  type View,
} from "./types"

type ListTab = Exclude<Tab, "convites">
const LIST_TABS: ListTab[] = ["todos", "revisao", "ativos", "cadastro", "suspensos", "recusados"]

const fetchList = async (aba: ListTab, q: string): Promise<CollaboratorListData> => {
  const params = new URLSearchParams({ aba })
  if (q) params.set("q", q)
  const res = await fetch(`/api/colaboradores?${params}`)
  if (!res.ok) throw new Error("Falha ao carregar colaboradores")
  return res.json()
}

const listQuery = (aba: ListTab, q: string) => ({
  queryKey: ["collaborators", aba, q] as const,
  queryFn: () => fetchList(aba, q),
  // a lista muda por ações do corporativo e do colaborador: fresca só por 5 s. Depois disso
  // o cache ainda aparece na hora e é atualizado em segundo plano.
  staleTime: 5_000,
})

const detailHref = (id: string) => `/app/colaboradores/${id}`
const display = (r: CollaboratorRow) => r.legalName ?? r.name

function Progress({ row }: { row: CollaboratorRow }) {
  if (row.docsRequired === 0) return <span className="form-hint">Sem exigências</span>
  const pct = Math.round((row.docsApproved / row.docsRequired) * 100)
  return (
    <div className="documentation-cell">
      <div>
        <i style={{ width: `${pct}%` }} />
      </div>
      <strong>
        {row.docsApproved}/{row.docsRequired}
      </strong>
    </div>
  )
}

const byText = (a?: string | null, b?: string | null) => (a ?? "").localeCompare(b ?? "", "pt-BR")

// Colunas da tabela (Ant Design): uma informação por coluna
const columns: TableColumnsType<CollaboratorRow> = [
  {
    title: "CNPJ",
    dataIndex: "cnpj",
    render: (cnpj: string | null) => <strong style={{ whiteSpace: "nowrap" }}>{cnpj ? formatCnpj(cnpj) : "—"}</strong>,
    sorter: (a, b) => byText(a.cnpj, b.cnpj),
  },
  {
    title: "Colaborador",
    dataIndex: "name",
    render: (_: string, r) => (
      <Link className="table-person" href={detailHref(r.id)} onClick={(e) => e.stopPropagation()}>
        <Avatar initials={initialsOf(r.name)} name={r.name} size="sm" tone={r.name.length} />
        <strong>{r.name}</strong>
      </Link>
    ),
    sorter: (a, b) => byText(a.name, b.name),
  },
  { title: "E-mail", dataIndex: "email", render: (email: string) => <span style={{ whiteSpace: "nowrap" }}>{email}</span> },
  { title: "Cargo", dataIndex: "jobTitle", render: (cargo: string | null) => cargo ?? "—", sorter: (a, b) => byText(a.jobTitle, b.jobTitle) },
  {
    title: "Empresa",
    dataIndex: "legalName",
    render: (nome: string | null) => <strong>{nome ?? "—"}</strong>,
    sorter: (a, b) => byText(a.legalName, b.legalName),
  },
  { title: "Documentos aprovados", key: "docs", render: (_: unknown, r) => <Progress row={r} /> },
  { title: "Status", dataIndex: "status", render: (_: unknown, r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge> },
  {
    title: "",
    key: "abrir",
    width: 48,
    render: (_: unknown, r) => (
      <Link aria-label={`Abrir ${r.name}`} href={detailHref(r.id)} onClick={(e) => e.stopPropagation()}>
        <Icon name="chevron" size={16} />
      </Link>
    ),
  },
]

// Lista com abas, busca e dois modos de visualização. O primeiro carregamento vem pronto
// do servidor; trocar de aba, buscar e voltar à tela usam o cache do TanStack Query
// (sem ir ao banco de novo enquanto o dado estiver fresco).
export function CollaboratorsView({
  initial,
}: {
  initial: { aba: ListTab; q: string; visao: View; data: CollaboratorListData }
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [aba, setAba] = useState<ListTab>(initial.aba)
  const [visao, setVisao] = useState<View>(initial.visao)
  const [input, setInput] = useState(initial.q)
  const [q, setQ] = useState(initial.q)

  // espera a pessoa parar de digitar antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250)
    return () => clearTimeout(t)
  }, [input])

  // mantém a URL compartilhável sem recarregar a página
  useEffect(() => {
    window.history.replaceState(null, "", listHref({ aba, q, visao }))
  }, [aba, q, visao])

  const { data, isPlaceholderData, isError } = useQuery({
    ...listQuery(aba, q),
    initialData: aba === initial.aba && q === initial.q ? initial.data : undefined,
    placeholderData: keepPreviousData,
  })

  const rows = data?.rows ?? []

  return (
    <>
      <nav aria-label="Seções de colaboradores" className="page-tabs">
        {LIST_TABS.map((tab) => (
          <button
            aria-current={aba === tab ? "page" : undefined}
            key={tab}
            // adianta a consulta da aba ao passar o mouse
            onMouseEnter={() => queryClient.prefetchQuery(listQuery(tab, q))}
            onClick={() => setAba(tab)}
            type="button"
          >
            {TAB_LABELS[tab]}
            {data && <span className="page-tab-count">{data.counts[tab]}</span>}
          </button>
        ))}
        <Link href={listHref({ aba: "convites" })}>{TAB_LABELS.convites}</Link>
      </nav>

      <Card className="workspace-table-card">
        <div className="workspace-table-toolbar">
          <div className="table-search" role="search">
            <Icon name="search" size={17} />
            <input
              aria-label="Buscar por nome ou CNPJ"
              onChange={(e) => setInput(e.target.value)}
              placeholder="Buscar por nome, cargo ou CNPJ..."
              value={input}
            />
          </div>
          <div aria-label="Modo de visualização" className="view-toggle" role="group">
            <button aria-current={visao === "tabela" ? "true" : undefined} onClick={() => setVisao("tabela")} type="button">
              <Icon name="menu" size={16} />
              Tabela
            </button>
            <button aria-current={visao === "cards" ? "true" : undefined} onClick={() => setVisao("cards")} type="button">
              <Icon name="grid" size={16} />
              Cards
            </button>
          </div>
        </div>

        <div style={{ opacity: isPlaceholderData ? 0.55 : 1, transition: "opacity .15s" }}>
          {isError ? (
            <p className="form-alert" style={{ margin: 24 }} role="alert">
              Não foi possível carregar os colaboradores. Tente novamente.
            </p>
          ) : rows.length === 0 ? (
            <p className="form-hint" style={{ padding: 24 }}>
              {q ? `Nenhum colaborador encontrado para “${q}”.` : "Nenhum colaborador nesta seção."}
            </p>
          ) : visao === "cards" ? (
            <div className="collab-cards">
              {rows.map((r) => (
                <Link className="collab-card" href={detailHref(r.id)} key={r.id}>
                  <div className="collab-card-head">
                    <Avatar initials={initialsOf(display(r))} name={display(r)} size="sm" tone={r.name.length} />
                    <div>
                      <strong>{display(r)}</strong>
                      <span>{r.jobTitle ?? r.name}</span>
                    </div>
                  </div>
                  <div className="form-hint">{r.cnpj ? `CNPJ ${formatCnpj(r.cnpj)}` : "CNPJ não informado"}</div>
                  <Progress row={r} />
                  <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <DataTable<CollaboratorRow>
              // o andamento dos documentos só interessa a quem está analisando o cadastro
              columns={aba === "revisao" ? columns : columns.filter((c) => c.key !== "docs")}
              dataSource={rows}
              locale={{ emptyText: "Nenhum colaborador" }}
              onRow={(r) => ({ className: "row-link", onClick: () => router.push(detailHref(r.id)) })}
              rowKey="id"
              scroll={{ x: "max-content" }}
            />
          )}
        </div>
      </Card>
    </>
  )
}
