"use client"

import { useActionState, useState, startTransition } from "react"
import { Button, Card } from "@/figma/ui"
import { ContractFields } from "../contract-fields"
import { CollaboratorPicker, type PickerOption } from "@/components/collaborator-picker"
import { createContract, type ContractFormValues } from "../actions"

type Option = { id: string; label: string }

const empty: ContractFormValues = {
  name: "",
  description: "",
  responsibleUserId: "",
  startDate: "",
  endDate: "",
  amount: "",
  invoiceDueDay: "",
  collaboratorIds: [],
  docs: [],
}

export function ContractForm({
  members,
  collaborators,
  currentUserId,
}: {
  members: Option[]
  collaborators: PickerOption[]
  currentUserId: string
}) {
  const [state, action, pending] = useActionState(createContract, undefined)
  // o formulário não é reiniciado depois de um erro (o envio é feito à mão, abaixo)
  const v = state?.values ?? { ...empty, responsibleUserId: currentUserId }
  const [docs, setDocs] = useState<{ key: number; name: string; required: boolean }[]>(
    v.docs.map((d, i) => ({ key: i, ...d })),
  )
  const [nextKey, setNextKey] = useState(v.docs.length)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      style={{ display: "grid", gap: 24 }}
    >
      {state?.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Dados do contrato</strong>
            <span>Informações gerais e período de vigência.</span>
          </div>
        </div>
        <ContractFields members={members} values={v} />
      </Card>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Colaboradores</strong>
            <span>
              Escolha quem atua neste contrato. Só aparecem colaboradores ativos; você pode adicionar outros depois, na página do contrato.
            </span>
          </div>
        </div>
        <CollaboratorPicker initialSelected={v.collaboratorIds} options={collaborators} />
      </Card>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Documentos específicos deste contrato</strong>
            <span>Além dos documentos que a empresa já exige de todo colaborador (Configurações).</span>
          </div>
          <Button
            icon="plus"
            onClick={() => {
              setDocs((d) => [...d, { key: nextKey, name: "", required: true }])
              setNextKey((k) => k + 1)
            }}
            variant="ghost"
          >
            Adicionar documento
          </Button>
        </div>
        {docs.length === 0 ? (
          <p className="form-hint">Nenhum documento específico. Você pode adicionar depois.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {docs.map((d) => (
              <div className="doc-row" key={d.key}>
                <input
                  aria-label="Nome do documento"
                  className="doc-row-name"
                  maxLength={120}
                  name="docName"
                  onChange={(e) => setDocs((list) => list.map((x) => (x.key === d.key ? { ...x, name: e.target.value } : x)))}
                  placeholder="Ex.: Certidão negativa trabalhista"
                  value={d.name}
                />
                <select
                  aria-label="Obrigatoriedade"
                  name="docRequired"
                  onChange={(e) => setDocs((list) => list.map((x) => (x.key === d.key ? { ...x, required: e.target.value === "1" } : x)))}
                  value={d.required ? "1" : "0"}
                >
                  <option value="1">Obrigatório</option>
                  <option value="0">Opcional</option>
                </select>
                <button aria-label="Remover documento" className="upload-remove" onClick={() => setDocs((list) => list.filter((x) => x.key !== d.key))} type="button">
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="portal-form-actions" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
        <Button href="/app/contratos" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={pending} loading={pending} type="submit">
          Criar contrato
        </Button>
      </div>
    </form>
  )
}
