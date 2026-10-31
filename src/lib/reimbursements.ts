// Regras e rótulos do reembolso, usados no portal do colaborador e no corporativo.
// Sem nada de servidor aqui: o arquivo também é importado por componentes de cliente.

export type ReimbursementStatus = "submitted" | "approved" | "rejected" | "paid"

export const reimbursementStatusLabel: Record<ReimbursementStatus, string> = {
  submitted: "Em revisão",
  approved: "Aprovado",
  rejected: "Recusado",
  paid: "Pago",
}

export const reimbursementStatusTone = { submitted: "warning", approved: "info", rejected: "danger", paid: "success" } as const

export const CATEGORIES = [
  { id: "transporte", label: "Transporte (táxi, app, pedágio)" },
  { id: "passagem", label: "Passagem (aérea, ônibus, trem)" },
  { id: "hospedagem", label: "Hospedagem" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "combustivel", label: "Combustível e estacionamento" },
  { id: "material", label: "Material e equipamento" },
  { id: "outros", label: "Outros" },
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label.replace(/ \(.*\)$/, "") ?? id
export const isCategory = (id: string): id is CategoryId => CATEGORIES.some((c) => c.id === id)

/** Quantos comprovantes cabem em um pedido e o teto de cada arquivo (o mesmo das outras telas) */
export const MAX_RECEIPTS = 8
