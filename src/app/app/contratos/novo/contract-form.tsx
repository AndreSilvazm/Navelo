"use client"

import { useActionState, startTransition } from "react"
import { Button, Card, UploadZone } from "@/figma/ui"
import { ContractFields } from "../contract-fields"
import type { PickerOption } from "@/components/collaborator-picker"
import { CollaboratorSelect } from "@/components/collaborator-select"
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
  collaboratorId: "",
}

export function ContractForm({
  members,
  collaborators,
  currentUserId,
  preselected,
  storageOn,
}: {
  members: Option[]
  collaborators: PickerOption[]
  currentUserId: string
  /** colaborador já escolhido (vem do link "Criar contrato" na página dele) */
  preselected?: string
  /** há armazenamento de arquivos neste ambiente (então o documento do contrato é obrigatório) */
  storageOn: boolean
}) {
  const [state, action, pending] = useActionState(createContract, undefined)
  // o formulário não é reiniciado depois de um erro (o envio é feito à mão, abaixo)
  const v = state?.values ?? { ...empty, responsibleUserId: currentUserId, collaboratorId: preselected ?? "" }
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
            <strong>Colaborador</strong>
            <span>Cada contrato é de um colaborador, e cada colaborador tem um contrato ativo por vez. Só aparecem colaboradores ativos que ainda não têm contrato. Busque pelo nome ou pelo CNPJ.</span>
          </div>
        </div>
        {collaborators.length === 0 ? (
          <p className="form-hint">Nenhum colaborador disponível: todos os ativos já têm contrato, ou ainda não há colaborador ativo.</p>
        ) : (
          <div className="field">
            <span className="field-label">Colaborador do contrato</span>
            <CollaboratorSelect initial={v.collaboratorId} options={collaborators} />
          </div>
        )}
      </Card>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Documento do contrato</strong>
            <span>
              O contrato de adesão em que a pessoa foi contratada. PDF, PNG ou JPG, até 5 MB. Outros documentos deste contrato podem ser
              anexados depois, na aba Arquivos da página do contrato.
            </span>
          </div>
        </div>
        {storageOn ? (
          <UploadZone accept=".pdf,.png,.jpg,.jpeg" formats="PDF, PNG ou JPG • Máx. 5 MB" maxSizeMB={5} name="file" required title="Arraste o contrato de adesão aqui" />
        ) : (
          <p className="form-hint">O armazenamento de arquivos não está configurado neste ambiente: o contrato será criado sem o documento.</p>
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
