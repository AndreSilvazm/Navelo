"use client"

import { useActionState, useState } from "react"
import { Badge, Button, UploadZone } from "@/figma/ui"
import type { ChecklistItem } from "@/lib/collaborators"
import { submitDocuments } from "./actions"

const docTone = { submitted: "info", approved: "success", rejected: "danger" } as const
const docLabel = { submitted: "Enviado", approved: "Aprovado", rejected: "Recusado" } as const

// Todos os documentos num formulário só. Cada exigência tem sua área de upload;
// o envio só libera quando todas as obrigatórias estiverem anexadas.
export function DocumentsForm({ items }: { items: ChecklistItem[] }) {
  const [state, action, pending] = useActionState(submitDocuments, undefined)
  const [staged, setStaged] = useState<Record<string, boolean>>({})

  // pede arquivo se nunca enviou ou se foi recusado; o resto já está com o corporativo
  const needsFile = (i: ChecklistItem) => !i.document || i.document.status === "rejected"
  const pendingRequired = items.filter((i) => i.requirement.required && needsFile(i))
  const attached = pendingRequired.filter((i) => staged[i.requirement.id]).length
  const canSubmit = attached === pendingRequired.length

  return (
    <form action={action} style={{ display: "grid", gap: 20 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}

      {items.length === 0 && <p className="form-hint">Nenhum documento é exigido no momento. Você já pode enviar para análise.</p>}

      {items.map((item) => {
        const { requirement, document } = item
        return (
          <div className="onboarding-doc" key={requirement.id}>
            <div className="onboarding-doc-head">
              <div>
                <strong>{requirement.name}</strong>
                {requirement.description && <div className="form-hint">{requirement.description}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Badge tone={requirement.required ? "warning" : "neutral"}>
                  {requirement.required ? "Obrigatório" : "Opcional"}
                </Badge>
                {document && <Badge tone={docTone[document.status]}>{docLabel[document.status]}</Badge>}
                {!document && staged[requirement.id] && <Badge tone="success">Anexado</Badge>}
              </div>
            </div>

            {document?.status === "rejected" && document.reviewNote && (
              <p className="form-alert">Motivo da recusa: {document.reviewNote}</p>
            )}
            {document && document.status !== "rejected" && <div className="form-hint">Arquivo: {document.fileName}</div>}

            {needsFile(item) && (
              <UploadZone
                accept=".pdf,.png,.jpg,.jpeg"
                disabled={pending}
                formats="PDF, PNG ou JPG • Máx. 5 MB"
                maxSizeMB={5}
                name={`doc_${requirement.id}`}
                onFileChange={(file) => setStaged((s) => ({ ...s, [requirement.id]: !!file }))}
                title={document ? "Arraste o novo arquivo aqui" : "Arraste o arquivo aqui"}
              />
            )}
          </div>
        )
      })}

      <div className="portal-form-actions" style={{ alignItems: "center" }}>
        {pendingRequired.length > 0 && (
          <span className="form-hint" style={{ marginRight: "auto" }}>
            {attached} de {pendingRequired.length} documentos obrigatórios anexados
          </span>
        )}
        <Button disabled={!canSubmit || pending} loading={pending} type="submit">
          Enviar documentos para análise
        </Button>
      </div>
    </form>
  )
}
