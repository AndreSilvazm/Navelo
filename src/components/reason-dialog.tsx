"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/figma/ui"

type Props = {
  open: boolean
  title: string
  description?: string
  label: string
  confirmLabel: string
  pending?: boolean
  error?: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}

// Janela (modal) para pedir um motivo antes de recusar/suspender algo. Padrão da plataforma
// para decisões que exigem justificativa: o motivo é obrigatório e fica registrado com a data.
export function ReasonDialog({ open, title, description, label, confirmLabel, pending, error, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // abre/fecha o <dialog> nativo (traz foco, Esc para fechar e fundo escurecido)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-labelledby="reason-dialog-title"
      className="modal"
      onClick={(e) => e.target === ref.current && !pending && onClose()} // clique no fundo fecha
      onClose={onClose}
      ref={ref}
    >
      {/* o formulário só existe com o modal aberto: ao reabrir, o campo volta vazio */}
      {open && <ReasonForm {...{ title, description, label, confirmLabel, pending, error, onConfirm, onClose }} />}
    </dialog>
  )
}

function ReasonForm({ title, description, label, confirmLabel, pending, error, onConfirm, onClose }: Omit<Props, "open">) {
  const [reason, setReason] = useState("")

  return (
    <form
      className="modal-body"
      onSubmit={(e) => {
        e.preventDefault()
        if (reason.trim()) onConfirm(reason.trim())
      }}
    >
      <div>
        <strong id="reason-dialog-title">{title}</strong>
        {description && <p className="form-hint" style={{ marginTop: 4 }}>{description}</p>}
      </div>
      <label className="field">
        <span className="field-label">{label}</span>
        <textarea autoFocus className="textarea" maxLength={500} onChange={(e) => setReason(e.target.value)} required rows={4} value={reason} />
      </label>
      {error && (
        <p className="field-message" role="alert">
          Não foi possível concluir. Tente novamente.
        </p>
      )}
      <div className="modal-actions">
        <Button disabled={pending} onClick={onClose} variant="ghost">
          Cancelar
        </Button>
        <Button disabled={pending || !reason.trim()} loading={pending} type="submit" variant="dark">
          {confirmLabel}
        </Button>
      </div>
    </form>
  )
}
