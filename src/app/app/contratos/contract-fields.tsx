"use client"

import { Icon, TextField } from "@/figma/ui"
import { InfoTip } from "@/components/info-tip"
import { maskCurrency } from "@/lib/masks"

export type ContractFieldValues = {
  name: string
  description: string
  responsibleUserId: string
  startDate: string
  endDate: string
  amount: string
  invoiceDueDay: string
}

// Campos de dados do contrato, usados ao criar e ao editar.
export function ContractFields({ values: v, members }: { values: ContractFieldValues; members: { id: string; label: string }[] }) {
  return (
    <div className="form-grid">
      <TextField defaultValue={v.name} label="Nome do contrato" name="name" placeholder="Ex.: Contrato Alpha" required />
      <TextField defaultValue={v.description} label="Projeto ou tipo (opcional)" name="description" placeholder="Ex.: Projeto de Tecnologia" />
      <TextField defaultValue={v.startDate} label="Início" name="startDate" required type="date" />
      <label className="field">
        <span className="field-label">
          Término (opcional){" "}
          <InfoTip text="Deixe vazio se o contrato não tem prazo final. Ele segue vigente até ser encerrado." />
        </span>
        <span className="field-control">
          <input defaultValue={v.endDate} name="endDate" type="date" />
        </span>
      </label>
      <label className="field">
        <span className="field-label">
          Valor do contrato em R$ (opcional){" "}
          <InfoTip text="Deixe vazio se o valor ainda não é conhecido. É comum em contratos sem prazo final, que seguem sendo renovados. Você pode definir depois." />
        </span>
        <span className="field-control">
          <input defaultValue={v.amount} inputMode="numeric" name="amount" onChange={maskAmount} placeholder="A definir" />
        </span>
      </label>
      <label className="field">
        <span className="field-label">
          Prazo para envio das notas fiscais{" "}
          <InfoTip text="Vale para todos os colaboradores deste contrato. Em meses mais curtos, vale o último dia." />
        </span>
        <span className="field-control field-select">
          <select defaultValue={v.invoiceDueDay} name="invoiceDueDay">
            <option value="">Sem prazo definido</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                Até o dia {day} de cada mês
              </option>
            ))}
          </select>
          <Icon name="chevron" size={16} />
        </span>
      </label>
      <label className="field">
        <span className="field-label">Responsável</span>
        <span className="field-control field-select">
          <select defaultValue={v.responsibleUserId} name="responsibleUserId">
            <option value="">Sem responsável</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={16} />
        </span>
      </label>
    </div>
  )
}

function maskAmount(e: React.ChangeEvent<HTMLInputElement>) {
  e.currentTarget.value = maskCurrency(e.currentTarget.value)
}
