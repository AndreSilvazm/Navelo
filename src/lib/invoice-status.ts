export type InvoiceStatusValue = "submitted" | "approved" | "rejected" | "paid"

// Ciclo da nota: em revisão -> aprovada -> paga (ou recusada). Aprovar não é pagar.
export const invoiceStatusLabel: Record<InvoiceStatusValue, string> = {
  submitted: "Em revisão",
  approved: "Aprovada",
  rejected: "Recusada",
  paid: "Paga",
}

export const invoiceStatusTone = { submitted: "warning", approved: "info", rejected: "danger", paid: "success" } as const

// "2026-10-15" -> "10/2026" (a competência é mensal)
export const competenceLabel = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`
