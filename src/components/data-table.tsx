"use client"

import { Table, type TableColumnsType, type TableProps } from "antd"
import { useMemo } from "react"

/**
 * Tabela do Ant Design com um detalhe para o celular: cada célula ganha o nome da coluna em
 * `data-label`. Em telas pequenas o CSS (globals.css, "Tabelas no celular") troca a tabela por
 * uma lista de cartões, e é esse atributo que escreve "Valor", "Situação"... ao lado de cada dado.
 * No computador nada muda.
 */
export function DataTable<T extends object>({ columns, ...props }: TableProps<T>) {
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
  return <Table<T> columns={labelled} {...props} />
}
