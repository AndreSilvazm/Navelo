import { formatDate, formatInvoiceDue } from "@/lib/format"

type Summary = {
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  invoiceDueDay: number | null
  responsible: string | null
}

// Dados do contrato para o colaborador conferir (usado no envio da nota e na página do contrato).
export function ContractSummary({ contract }: { contract: Summary }) {
  return (
    <dl className="contract-summary">
      <div>
        <dt>Contrato</dt>
        <dd>
          {contract.name}
          {contract.description && <small>{contract.description}</small>}
        </dd>
      </div>
      <div>
        <dt>Período</dt>
        <dd>
          {formatDate(contract.startDate)} — {contract.endDate ? formatDate(contract.endDate) : "sem prazo final"}
        </dd>
      </div>
      <div>
        <dt>Envio das notas fiscais</dt>
        <dd>{formatInvoiceDue(contract.invoiceDueDay)}</dd>
      </div>
      <div>
        <dt>Responsável na empresa</dt>
        <dd>{contract.responsible ?? "—"}</dd>
      </div>
    </dl>
  )
}
