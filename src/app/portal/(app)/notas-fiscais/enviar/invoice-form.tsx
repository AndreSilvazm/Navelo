"use client"

import { startTransition, useActionState, useState } from "react"
import { Button, Card, Icon, TextField, UploadZone } from "@/figma/ui"
import { ContractSummary } from "@/components/contract-summary"
import { DocumentViewer } from "@/components/document-viewer"
import { extractInvoice } from "@/lib/invoice-extract"
import { maskCurrency } from "@/lib/masks"
import { createInvoice } from "../actions"

type Auto = Partial<Record<"number" | "amount" | "competence", boolean>>

const mimeOf = (f: File) =>
  f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : f.name.toLowerCase().endsWith(".xml") ? "application/xml" : "application/octet-stream")

type ContractInfo = {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  invoiceDueDay: number | null
  responsible: string | null
}

export function InvoiceForm({ contracts }: { contracts: ContractInfo[] }) {
  const [state, action, pending] = useActionState(createInvoice, undefined)
  const [file, setFile] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [note, setNote] = useState("")
  const [number, setNumber] = useState("")
  const [amount, setAmount] = useState("")
  const [competence, setCompetence] = useState("")
  const [description, setDescription] = useState("")
  const [contractId, setContractId] = useState(contracts.length === 1 ? contracts[0].id : "")
  const [auto, setAuto] = useState<Auto>({})
  const selected = contracts.find((c) => c.id === contractId)

  // ao anexar a nota, lê número, valor e competência e preenche os campos (todos editáveis)
  const onFile = async (f: File | null) => {
    setFile(f)
    setAuto({})
    setNote("")
    if (!f) return
    setReading(true)
    const found = await extractInvoice(f)
    setReading(false)

    const next: Auto = {}
    if (found.number) {
      setNumber(found.number)
      next.number = true
    }
    if (found.amountCents) {
      setAmount(maskCurrency(String(found.amountCents)))
      next.amount = true
    }
    if (found.competence) {
      setCompetence(found.competence)
      next.competence = true
    }
    setAuto(next)
    const n = Object.keys(next).length
    setNote(
      n === 3
        ? "Lemos o número, o valor e a competência da nota. Confira se está tudo certo."
        : n > 0
          ? "Lemos parte dos dados da nota. Confira e complete o que faltar."
          : "Não conseguimos ler os dados desta nota automaticamente. Preencha os campos abaixo.",
    )
  }

  const hint = (key: keyof Auto) => (auto[key] ? "Lido da nota — confira" : undefined)
  const edit = (key: keyof Auto) => setAuto((a) => ({ ...a, [key]: false }))

  return (
    <form
      // envio à mão: um erro não apaga o que a pessoa já preencheu
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      className="invoice-layout"
    >
      <div className="invoice-main">
        {state?.error && (
          <p className="form-alert" role="alert">
            {state.error}
          </p>
        )}

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>1. Arquivo da nota fiscal</strong>
              <span>PDF, XML, PNG ou JPG, até 5 MB. Em PDF ou XML, lemos os dados automaticamente.</span>
            </div>
          </div>
          <UploadZone
            accept=".pdf,.xml,.png,.jpg,.jpeg"
            disabled={pending}
            formats="PDF, XML, PNG ou JPG • Máx. 5 MB"
            maxSizeMB={5}
            name="file"
            onFileChange={onFile}
            required
            title="Arraste sua nota fiscal aqui"
          />
          {reading && <p className="form-hint" style={{ marginTop: 10 }}>Lendo a nota…</p>}
          {!reading && note && (
            <p className="form-hint" role="status" style={{ marginTop: 10 }}>
              {note}
            </p>
          )}
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>2. Dados da nota</strong>
              <span>Confira e corrija o que for preciso.</span>
            </div>
          </div>
          <div className="form-grid">
            {contracts.length > 0 && (
              <label className="field">
                <span className="field-label">Contrato</span>
                <span className="field-control field-select">
                  <select name="contractId" onChange={(e) => setContractId(e.target.value)} required value={contractId}>
                    <option value="">Selecione</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron" size={16} />
                </span>
              </label>
            )}
            <TextField
              hint={hint("number")}
              label="Número da nota"
              name="number"
              onValueChange={(v) => {
                setNumber(v)
                edit("number")
              }}
              required
              value={number}
            />
            <TextField
              hint={hint("amount")}
              label="Valor da nota (R$)"
              mask="currency"
              name="amount"
              onValueChange={(v) => {
                setAmount(v)
                edit("amount")
              }}
              placeholder="0,00"
              required
              value={amount}
            />
            <TextField
              hint={hint("competence")}
              label="Data de competência"
              name="competence"
              onValueChange={(v) => {
                setCompetence(v)
                edit("competence")
              }}
              required
              type="date"
              value={competence}
            />
          </div>
          {selected && (
            <div className="contract-card">
              <ContractSummary contract={selected} />
            </div>
          )}
          <label className="field" style={{ marginTop: 16 }}>
            <span className="field-label">Descrição (opcional)</span>
            <textarea
              className="textarea"
              maxLength={300}
              name="description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Serviços de desenvolvimento referentes a outubro"
              rows={3}
              value={description}
            />
          </label>
          <div className="portal-form-actions">
            <Button href="/portal/notas-fiscais" variant="secondary">
              Cancelar
            </Button>
            <Button disabled={pending || reading} loading={pending} type="submit">
              Enviar nota para revisão
            </Button>
          </div>
        </Card>
      </div>

      <aside className="invoice-preview">
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Pré-visualização</strong>
              <span>Confira a nota que você está enviando.</span>
            </div>
          </div>
          {file ? (
            <div className="doc-viewer">
              <DocumentViewer file={file} fileName={file.name} mimeType={mimeOf(file)} />
            </div>
          ) : (
            <div className="doc-review-empty">
              <Icon name="document" size={28} />
              <p>Anexe a nota para ver a pré-visualização aqui.</p>
            </div>
          )}
        </Card>
      </aside>
    </form>
  )
}
