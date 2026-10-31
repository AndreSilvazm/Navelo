"use client"

import { DatePicker, Input, Select } from "antd"
import dayjs from "dayjs"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export type AuditFilterValues = { filtro: string; acao?: string; quem?: string; de?: string; ate?: string; q?: string }

const DAY = "YYYY-MM-DD"

// Filtros do registro: ação, pessoa e período. Tudo vai para a URL e a consulta roda no servidor.
export function AuditFilters({
  values,
  actions,
  actors,
}: {
  values: AuditFilterValues
  actions: { value: string; label: string }[]
  actors: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const apply = (next: Partial<AuditFilterValues>) => {
    const merged = { ...values, ...next }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v) // volta para a primeira página
    startTransition(() => router.push(`/app/auditoria?${params}`))
  }

  const range = values.de && values.ate ? ([dayjs(values.de), dayjs(values.ate)] as [dayjs.Dayjs, dayjs.Dayjs]) : null

  return (
    <div className="audit-filters" style={{ opacity: pending ? 0.6 : 1 }}>
      <Input.Search
        allowClear
        aria-label="Buscar no registro"
        defaultValue={values.q}
        onSearch={(q) => apply({ q: q.trim().slice(0, 100) || undefined })}
        placeholder="Buscar por pessoa, CNPJ, empresa, ação ou IP"
        style={{ minWidth: 300, flex: "1 1 300px" }}
      />
      <Select
        allowClear
        aria-label="Filtrar por ação"
        onChange={(acao) => apply({ acao })}
        options={actions}
        placeholder="Ação"
        style={{ minWidth: 220 }}
        value={values.acao}
      />
      <Select
        allowClear
        aria-label="Filtrar por pessoa"
        filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
        onChange={(quem) => apply({ quem })}
        options={actors}
        placeholder="Quem"
        showSearch
        style={{ minWidth: 220 }}
        value={values.quem}
      />
      <DatePicker.RangePicker
        allowClear
        format="DD/MM/YYYY"
        onChange={(dates) => apply({ de: dates?.[0]?.format(DAY), ate: dates?.[1]?.format(DAY) })}
        placeholder={["De", "Até"]}
        value={range}
      />
    </div>
  )
}
