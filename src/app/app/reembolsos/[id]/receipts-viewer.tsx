"use client"

import { useState } from "react"
import { DocumentViewer } from "@/components/document-viewer"

export type Receipt = { id: string; fileName: string; mimeType: string; size: string }

// Mostra um comprovante por vez; os demais ficam numa lista para trocar com um clique
export function ReceiptsViewer({ reimbursementId, receipts, version }: { reimbursementId: string; receipts: Receipt[]; version: number }) {
  const [index, setIndex] = useState(0)
  const current = receipts[index]
  if (!current) return <p className="form-hint">Sem comprovantes.</p>
  const url = `/api/reembolsos/${reimbursementId}/arquivos/${current.id}?v=${version}`

  return (
    <>
      {receipts.length > 1 && (
        <div className="page-tabs" role="tablist" style={{ marginBottom: 12 }}>
          {receipts.map((r, i) => (
            <button aria-current={i === index ? "page" : undefined} key={r.id} onClick={() => setIndex(i)} role="tab" type="button">
              Comprovante {i + 1}
            </button>
          ))}
        </div>
      )}
      <p className="form-hint" style={{ marginBottom: 8 }}>
        {current.fileName} · {current.size} · <a href={`${url}&download=1`}>Baixar</a>
      </p>
      <div className="doc-viewer">
        <DocumentViewer fileName={current.fileName} key={current.id} mimeType={current.mimeType} url={url} />
      </div>
    </>
  )
}
