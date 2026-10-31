"use client"

import { Table, type TableColumnsType, type TablePaginationConfig, type TableProps } from "antd"
import { useMemo } from "react"

/**
 * Tabela do Ant Design com um detalhe para o celular: cada célula ganha o nome da coluna em
 * `data-label`. Em telas pequenas o CSS (globals.css, "Tabelas no celular") troca a tabela por
 * uma lista de cartões, e é esse atributo que escreve "Valor", "Situação"... ao lado de cada dado.
 * No computador nada muda.
 */
// Toda tabela do sistema tem paginação: 25 por página (dá para trocar) e o total de linhas. Quem precisar
// de outro comportamento passa `pagination` (ou `false`, para a paginação feita no servidor).
const DEFAULT_PAGINATION: TablePaginationConfig = {
  pageSize: 25,
  showSizeChanger: true,
  pageSizeOptions: [10, 25, 50, 100],
  showTotal: (total, range) => `${range[0]}–${range[1]} de ${total}`,
  hideOnSinglePage: false,
}

export function DataTable<T extends object>({ columns, pagination, ...props }: TableProps<T>) {
  const labelled = useMemo(
    () =>
      columns?.map((col) => {
        const title = typeof col.title === "string" ? col.title : undefined
        if (!title) return col
        const original = col.onCell
        return {
          ...col,
          onCell: (record: T, index?: number) => ({ ...(original?.(record, index) ?? {}), "data-label": title }),
        } as TableColumnsType<T>[number]
      }),
    [columns],
  )
  return <Table<T> columns={labelled} pagination={pagination === false ? false : { ...DEFAULT_PAGINATION, ...(pagination || {}) }} {...props} />
}
