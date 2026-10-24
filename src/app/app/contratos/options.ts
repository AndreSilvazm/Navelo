import type { PickerOption } from "@/components/collaborator-picker"
import { formatCnpj } from "@/lib/cnpj"

type CollaboratorLike = {
  id: string
  name: string
  legalName: string | null
  cnpj: string | null
  jobTitle: string | null
}

// Como o colaborador aparece nas listas de contrato: nome da pessoa em cima; embaixo, cargo,
// razão social (se for diferente do nome) e CNPJ. A busca também acha por empresa e CNPJ.
export function collaboratorOption(c: CollaboratorLike): PickerOption {
  const sameName = c.legalName?.trim().toLowerCase() === c.name.trim().toLowerCase()
  return {
    id: c.id,
    label: c.name,
    hint: [c.jobTitle, c.legalName && !sameName ? c.legalName : null, c.cnpj ? `CNPJ ${formatCnpj(c.cnpj)}` : null]
      .filter(Boolean)
      .join(" · "),
    keywords: [c.legalName, c.cnpj].filter(Boolean).join(" "),
  }
}
