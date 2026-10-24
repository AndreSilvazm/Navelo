type ContractLike = { status: "active" | "ended" | "canceled"; startDate: string; endDate: string | null }

// "Encerrado" também vale quando a data de término já passou, mesmo com status ativo
export function contractStatusOf(c: ContractLike) {
  const today = new Date().toISOString().slice(0, 10)
  if (c.status === "canceled") return { label: "Cancelado", tone: "danger" } as const
  if (c.status === "ended" || (c.endDate && c.endDate < today)) return { label: "Encerrado", tone: "neutral" } as const
  if (c.startDate > today) return { label: "Agendado", tone: "info" } as const
  return { label: "Ativo", tone: "success" } as const
}
