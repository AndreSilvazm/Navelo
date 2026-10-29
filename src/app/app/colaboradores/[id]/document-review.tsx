"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Badge, Button, Icon } from "@/figma/ui"
import { DocumentViewer } from "@/components/document-viewer"
import { ReasonDialog } from "@/components/reason-dialog"
import { approveDocument, rejectDocument } from "../actions"
import { detailQueryKey, type ChecklistItemDTO } from "./types"

const docTone = { submitted: "info", approved: "success", rejected: "danger" } as const
const docLabel = { submitted: "Aguardando análise", approved: "Aprovado", rejected: "Recusado" } as const

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

// a versão (data do upload) na URL garante que um arquivo substituído não venha do cache antigo
export const documentUrl = (doc: { id: string; uploadedAt: string }) =>
  `/api/documentos/${doc.id}/arquivo?v=${new Date(doc.uploadedAt).getTime()}`

// Análise dos documentos: lista à esquerda, visualizador e decisão à direita, sem sair da página.
// Aprovar/recusar chama o servidor e depois atualiza o cache (a lista de colaboradores também).
export function DocumentReview({
  collaboratorId,
  items,
  canReview,
}: {
  collaboratorId: string
  items: ChecklistItemDTO[]
  canReview: boolean
}) {
  const queryClient = useQueryClient()
  const withDoc = items.filter((i) => i.document)
  const firstToReview = withDoc.find((i) => i.document!.status === "submitted") ?? withDoc[0] ?? items[0]
  const [selectedId, setSelectedId] = useState<string | undefined>(firstToReview?.requirement.id)
  const [rejecting, setRejecting] = useState(false)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: detailQueryKey(collaboratorId) }),
      queryClient.invalidateQueries({ queryKey: ["collaborators"] }),
    ])

  const approve = useMutation({ mutationFn: (docId: string) => approveDocument(docId), onSuccess: refresh })
  const reject = useMutation({
    mutationFn: ({ docId, reason }: { docId: string; reason: string }) => {
      const form = new FormData()
      form.set("note", reason)
      return rejectDocument(docId, form)
    },
    onSuccess: () => {
      setRejecting(false)
      return refresh()
    },
  })

  if (items.length === 0) {
    return <p className="form-hint">Esta empresa ainda não definiu documentos exigidos. Configure em Configurações.</p>
  }

  const required = items.filter((i) => i.requirement.required)
  const approvedCount = required.filter((i) => i.document?.status === "approved").length
  const selected = items.find((i) => i.requirement.id === selectedId) ?? items[0]
  const doc = selected.document
  const nextToReview = withDoc.find((i) => i.document!.status === "submitted" && i.requirement.id !== selected.requirement.id)
  const busy = approve.isPending || reject.isPending

  const select = (id: string) => {
    setSelectedId(id)
    setRejecting(false)
  }

  return (
    <div className="doc-review">
      <aside className="doc-review-list">
        <div className="doc-review-progress">
          <strong>
            {approvedCount} de {required.length}
          </strong>
          <span>obrigatórios aprovados</span>
          <div className="doc-review-bar">
            <i style={{ width: required.length ? `${(approvedCount / required.length) * 100}%` : "0%" }} />
          </div>
        </div>
        {items.map((i) => (
          <button
            aria-current={i.requirement.id === selected.requirement.id}
            className="doc-review-item"
            key={i.requirement.id}
            onClick={() => select(i.requirement.id)}
            type="button"
          >
            <span className={`doc-review-dot ${i.document?.status ?? "missing"}`}>
              {i.document?.status === "approved" ? <Icon name="check" size={13} /> : null}
            </span>
            <span className="doc-review-item-text">
              <strong>{i.requirement.name}</strong>
              <small>
                {i.document ? docLabel[i.document.status] : "Não enviado"}
                {!i.requirement.required && " · opcional"}
              </small>
            </span>
          </button>
        ))}
      </aside>

      <section className="doc-review-panel">
        <header className="doc-review-head">
          <div>
            <strong>{selected.requirement.name}</strong>
            {selected.requirement.description && <div className="form-hint">{selected.requirement.description}</div>}
          </div>
          {doc && <Badge tone={docTone[doc.status]}>{docLabel[doc.status]}</Badge>}
        </header>

        {!doc ? (
          <div className="doc-review-empty">
            <Icon name="document" size={28} />
            <p>O colaborador ainda não enviou este documento.</p>
          </div>
        ) : (
          <>
            <div className="doc-review-file">
              <span>
                {doc.fileName} · {size(doc.sizeBytes)} · enviado em {new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}
              </span>
              <span style={{ display: "flex", gap: 12 }}>
                <a href={documentUrl(doc)} rel="noreferrer" target="_blank">
                  Abrir em nova aba
                </a>
                <a href={`${documentUrl(doc)}&download=1`}>Baixar</a>
              </span>
            </div>

            <div className="doc-viewer">
              <DocumentViewer fileName={doc.fileName} mimeType={doc.mimeType} url={documentUrl(doc)} />
            </div>

            {doc.status !== "submitted" && doc.reviewedAt && (
              <p className="form-hint">
                {doc.status === "approved" ? "Aprovado" : "Recusado"} por {doc.reviewedBy ?? "usuário removido"} em{" "}
                {new Date(doc.reviewedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
            )}

            {doc.status === "rejected" && doc.reviewNote && (
              <p className="form-alert">Motivo da recusa: {doc.reviewNote}</p>
            )}

            {doc.status === "submitted" && !canReview && (
              <p className="form-hint">A análise abre quando o colaborador enviar o cadastro para revisão.</p>
            )}

            {(approve.isError || reject.isError) && (
              <p className="form-alert" role="alert">
                Não foi possível salvar a decisão. Tente novamente.
              </p>
            )}

            {doc.status === "submitted" && canReview && (
              <div className="doc-review-actions">
                <Button disabled={busy} onClick={() => setRejecting(true)} variant="secondary">
                  Recusar
                </Button>
                <Button disabled={busy} icon="check" loading={approve.isPending} onClick={() => approve.mutate(doc.id)}>
                  Aprovar documento
                </Button>
              </div>
            )}

            {nextToReview && (
              <button className="doc-review-next" onClick={() => select(nextToReview.requirement.id)} type="button">
                Próximo para revisar: {nextToReview.requirement.name} →
              </button>
            )}
          </>
        )}
      </section>

      <ReasonDialog
        confirmLabel="Confirmar recusa"
        description="O colaborador verá o motivo e poderá enviar o documento de novo. A data e quem recusou ficam registrados."
        error={reject.isError}
        label="Motivo da recusa"
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => doc && reject.mutate({ docId: doc.id, reason })}
        open={rejecting}
        pending={reject.isPending}
        title={`Recusar “${selected.requirement.name}”?`}
      />
    </div>
  )
}
