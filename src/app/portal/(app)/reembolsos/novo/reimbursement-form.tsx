"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { Button, Card, Icon, TextField } from "@/figma/ui"
import { CATEGORIES, MAX_RECEIPTS } from "@/lib/reimbursements"
import { createReimbursement } from "../actions"

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

export function ReimbursementForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createReimbursement, undefined)
  const [files, setFiles] = useState<File[]>([])
  const [localError, setLocalError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setLocalError("")
    const next = [...files]
    for (const f of Array.from(list)) {
      if (next.length >= MAX_RECEIPTS) return setLocalError(`No máximo ${MAX_RECEIPTS} comprovantes por pedido.`)
      if (f.size > 5 * 1024 * 1024) return setLocalError(`“${f.name}” passa de 5 MB.`)
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
    }
    setFiles(next)
    if (inputRef.current) inputRef.current.value = "" // permite escolher o mesmo arquivo de novo depois de remover
  }

  return (
    <form
      // envio à mão: um erro não apaga o que a pessoa já preencheu e os comprovantes vêm da lista abaixo
      onSubmit={(e) => {
        e.preventDefault()
        if (files.length === 0) return setLocalError("Anexe pelo menos um comprovante da despesa.")
        const data = new FormData(e.currentTarget)
        data.delete("files")
        for (const f of files) data.append("files", f)
        startTransition(() => action(data))
      }}
      style={{ display: "grid", gap: 24, maxWidth: 820 }}
    >
      {(state?.error || localError) && (
        <p className="form-alert" role="alert">
          {localError || state?.error}
        </p>
      )}

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>1. Dados da despesa</strong>
            <span>O que foi gasto, quando e quanto.</span>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Categoria</span>
            <span className="field-control field-select">
              <select defaultValue="" name="category" required>
                <option value="">Selecione</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={16} />
            </span>
          </label>
          <TextField label="Valor (R$)" mask="currency" name="amount" placeholder="0,00" required />
          <TextField label="Data da despesa" max={today} name="expenseDate" required type="date" />
          <TextField label="Estabelecimento (opcional)" maxLength={120} name="merchant" placeholder="Ex.: Hotel Central" />
          <TextField hint="Viagem, projeto ou evento a que a despesa pertence" label="Viagem ou projeto (opcional)" maxLength={120} name="trip" placeholder="Ex.: Visita ao cliente em Curitiba" />
        </div>
        <label className="field" style={{ marginTop: 16 }}>
          <span className="field-label">Descrição</span>
          <textarea className="textarea" maxLength={300} minLength={5} name="description" placeholder="O que foi e por que a despesa foi necessária" required rows={3} />
        </label>
      </Card>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>2. Comprovantes</strong>
            <span>Obrigatório: nota fiscal, recibo ou cupom. PDF, PNG ou JPG, até 5 MB cada (no máximo {MAX_RECEIPTS}).</span>
          </div>
        </div>
        <input accept=".pdf,.png,.jpg,.jpeg" hidden multiple name="files" onChange={(e) => addFiles(e.target.files)} ref={inputRef} type="file" />
        <div>
          <Button disabled={pending || files.length >= MAX_RECEIPTS} icon="upload" onClick={() => inputRef.current?.click()} variant="secondary">
            Escolher comprovantes
          </Button>
        </div>
        {files.length === 0 ? (
          <p className="form-hint" style={{ marginTop: 12 }}>
            Nenhum comprovante anexado ainda.
          </p>
        ) : (
          <ul className="receipt-list">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}`}>
                <span>
                  <strong>{f.name}</strong> <small className="form-hint">{size(f.size)}</small>
                </span>
                <button className="upload-remove" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} type="button">
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="portal-form-actions">
          <Button href="/portal/reembolsos" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={pending} loading={pending} type="submit">
            Enviar pedido de reembolso
          </Button>
        </div>
      </Card>
    </form>
  )
}
