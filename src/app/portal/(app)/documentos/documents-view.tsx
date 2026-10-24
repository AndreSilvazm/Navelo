"use client"

import { useState } from "react"
import { Badge, Icon } from "@/figma/ui"
import { DocumentViewer } from "@/components/document-viewer"

export type MyDocument = {
  requirementId: string
  name: string
  description: string | null
  required: boolean
  document: {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
    status: "submitted" | "approved" | "rejected"
    reviewNote: string | null
    uploadedAt: string
    reviewedAt: string | null
    reviewedBy: string | null
  } | null
}

const tone = { submitted: "info", approved: "success", rejected: "danger" } as const
const label = { submitted: "Em análise", approved: "Aprovado", rejected: "Recusado" } as const
const GROUPS = [
  { key: "approved", title: "Aprovados" },
  { key: "submitted", title: "Em análise" },
  { key: "rejected", title: "Recusados" },
  { key: "missing", title: "Não enviados" },
] as const

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const url = (d: NonNullable<MyDocument["document"]>) => `/api/documentos/${d.id}/arquivo?v=${new Date(d.uploadedAt).getTime()}`
const when = (iso: string) => new Date(iso).toLocaleDateString("pt-BR")

// Documentos que o colaborador enviou para a empresa: os aprovados primeiro, cada um aberto na própria tela.
export function DocumentsView({ items }: { items: MyDocument[] }) {
  const groupOf = (i: MyDocument) => i.document?.status ?? "missing"
  const first = items.find((i) => groupOf(i) === "approved") ?? items.find((i) => i.document)
  const [selectedId, setSelectedId] = useState(first?.requirementId)
  const selected = items.find((i) => i.requirementId === selectedId)
  const doc = selected?.document

  return (
    <div className="doc-review">
      <aside className="doc-review-list">
        {GROUPS.map((g) => {
          const list = items.filter((i) => groupOf(i) === g.key)
          if (list.length === 0) return null
          return (
            <div className="my-docs-group" key={g.key}>
              <span className="my-docs-title">
                {g.title} <b>{list.length}</b>
              </span>
              {list.map((i) => (
                <button
                  aria-current={i.requirementId === selectedId}
                  className="doc-review-item"
                  key={i.requirementId}
                  onClick={() => setSelectedId(i.requirementId)}
                  type="button"
                >
                  <span className={`doc-review-dot ${i.document?.status ?? "missing"}`}>
                    {i.document?.status === "approved" ? <Icon name="check" size={13} /> : null}
                  </span>
                  <span className="doc-review-item-text">
                    <strong>{i.name}</strong>
                    <small>
                      {i.document ? `${label[i.document.status]} · enviado em ${when(i.document.uploadedAt)}` : i.required ? "Obrigatório" : "Opcional"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )
        })}
      </aside>

      <section className="doc-review-panel">
        {!selected ? (
          <p className="form-hint">Selecione um documento para visualizar.</p>
        ) : (
          <>
            <header className="doc-review-head">
              <div>
                <strong>{selected.name}</strong>
                {selected.description && <div className="form-hint">{selected.description}</div>}
              </div>
              {doc && <Badge tone={tone[doc.status]}>{label[doc.status]}</Badge>}
            </header>

            {!doc ? (
              <div className="doc-review-empty">
                <Icon name="document" size={28} />
                <p>Você ainda não enviou este documento.</p>
              </div>
            ) : (
              <>
                <div className="doc-review-file">
                  <span>
                    {doc.fileName} · {size(doc.sizeBytes)} · enviado em {when(doc.uploadedAt)}
                  </span>
                  <span style={{ display: "flex", gap: 12 }}>
                    <a href={url(doc)} rel="noreferrer" target="_blank">
                      Abrir em nova aba
                    </a>
                    <a href={`${url(doc)}&download=1`}>Baixar</a>
                  </span>
                </div>
                {doc.status === "approved" && doc.reviewedAt && (
                  <p className="form-hint" style={{ color: "var(--zn-success)" }}>
                    Aprovado por {doc.reviewedBy ?? "usuário removido"} em {when(doc.reviewedAt)}
                  </p>
                )}
                {doc.status === "rejected" && doc.reviewNote && <p className="form-alert">Motivo da recusa: {doc.reviewNote}</p>}
                <div className="doc-viewer">
                  <DocumentViewer fileName={doc.fileName} mimeType={doc.mimeType} url={url(doc)} />
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
