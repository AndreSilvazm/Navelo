"use client"

import { useActionState, useRef } from "react"
import { Button, TextField, UploadZone } from "@/figma/ui"
import { uploadContractFile } from "../actions"

// Anexa um documento ao contrato (contrato assinado, aditivo, anexo...)
export function ContractFileForm({ contractId }: { contractId: string }) {
  const [state, action, pending] = useActionState(uploadContractFile.bind(null, contractId), undefined)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form action={action} key={state?.success ? "ok" : "form"} ref={formRef} style={{ display: "grid", gap: 14 }}>
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="form-hint" role="status">
          {state.success}
        </p>
      )}
      <TextField hint="Ex.: Contrato assinado, Aditivo 1, Termo de confidencialidade" label="Nome do documento" maxLength={120} name="title" placeholder="Contrato assinado" />
      <UploadZone accept=".pdf,.png,.jpg,.jpeg" disabled={pending} formats="PDF, PNG ou JPG • Máx. 5 MB" maxSizeMB={5} name="file" required title="Arraste o arquivo do contrato aqui" />
      <div>
        <Button disabled={pending} icon="upload" loading={pending} type="submit">
          Anexar ao contrato
        </Button>
      </div>
    </form>
  )
}
