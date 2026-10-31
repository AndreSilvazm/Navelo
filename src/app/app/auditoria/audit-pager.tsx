"use client"

import { Pagination } from "antd"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

// Paginação numerada da auditoria. A consulta roda no servidor: trocar de página ou de tamanho só
// muda a URL, mantendo os filtros e a busca.
export function AuditPager({ total, page, size, params }: { total: number; page: number; size: number; params: Record<string, string> }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const go = (p: number, s: number) => {
    const qs = new URLSearchParams(params)
    if (s !== 25) qs.set("tam", String(s))
    if (p > 1) qs.set("pagina", String(p))
    start(() => router.push(`/app/auditoria?${qs}`))
  }

  return (
    <div className="audit-pager" style={{ opacity: pending ? 0.6 : 1 }}>
      <Pagination
        current={page}
        onChange={(p, s) => go(s !== size ? 1 : p, s)}
        pageSize={size}
        pageSizeOptions={[25, 50, 100]}
        showSizeChanger
        showTotal={(t, range) => `${range[0]}–${range[1]} de ${t}`}
        total={total}
      />
    </div>
  )
}
