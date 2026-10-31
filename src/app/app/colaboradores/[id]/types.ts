// Dados da página do colaborador: só JSON simples (datas em ISO), porque trafegam pela API
// e ficam no cache do navegador (TanStack Query).
import type { CollaboratorStatus } from "@/db/schema"

export type DocumentStatus = "submitted" | "approved" | "rejected"

export type ChecklistItemDTO = {
  requirement: { id: string; name: string; description: string | null; required: boolean }
  document: {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
    status: DocumentStatus
    reviewNote: string | null
    uploadedAt: string
    reviewedAt: string | null
    reviewedBy: string | null
  } | null
}

export type BankAccountDTO = {
  bankCode: string
  bankName: string
  bankAgency: string
  bankAccount: string
  bankAccountType: "checking" | "savings"
  pixKey: string | null
}

export type CollaboratorDetailData = {
  id: string
  status: CollaboratorStatus
  /** quem está vendo é o próprio colaborador (agente que também presta serviço) */
  isSelf: boolean
  name: string
  email: string
  jobTitle: string | null
  legalName: string | null
  tradeName: string | null
  cnpj: string | null
  phone: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  createdAt: string
  profileCompletedAt: string | null
  submittedAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  /** contas bancárias da pessoa: PJ (da empresa) e PF (opcional), de bank_accounts */
  bankAccounts: { pj: BankAccountDTO | null; pf: BankAccountDTO | null }
  /** pedidos de conta (troca ou cadastro) esperando decisão do corporativo: no máximo um por tipo */
  pendingBankChanges: (BankAccountDTO & { id: string; kind: "pj" | "pf"; createdAt: string })[]
  invitedAt: string | null
  invitedBy: string | null
  inviteAcceptedAt: string | null
  rejectedAt: string | null
  rejectedBy: string | null
  rejectionReason: string | null
  suspendedAt: string | null
  suspendedBy: string | null
  suspensionReason: string | null
  history: { id: string; from: CollaboratorStatus; to: CollaboratorStatus; reason: string | null; by: string | null; at: string }[]
  invoices: {
    id: string
    number: string
    amountCents: number
    competence: string // AAAA-MM-DD
    description: string | null
    status: "submitted" | "approved" | "rejected" | "paid"
    contractName: string | null
    fileName: string
    mimeType: string
    createdAt: string
    reviewedAt: string | null
    reviewedBy: string | null
    reviewNote: string | null
    paidAt: string | null
    paidBy: string | null
  }[]
  /** pedidos de reembolso do colaborador (sem os comprovantes, que vêm pela rota própria) */
  reimbursements: {
    id: string
    category: string
    description: string
    amountCents: number
    expenseDate: string // AAAA-MM-DD
    status: "submitted" | "approved" | "rejected" | "paid"
    createdAt: string
    paidAt: string | null
  }[]
  monthlyAmountCents: number | null
  monthlyAmountUpdatedAt: string | null
  monthlyAmountUpdatedBy: string | null
  contracts: {
    id: string
    name: string
    status: "active" | "ended" | "canceled"
    startDate: string // AAAA-MM-DD
    endDate: string | null
    linkedAt: string // quando entrou no contrato
  }[]
  checklist: ChecklistItemDTO[]
}

export const detailQueryKey = (id: string) => ["collaborator", id] as const

// liberar o acesso exige todos os documentos obrigatórios aprovados
export const isReadyForApproval = (items: ChecklistItemDTO[]) =>
  items.every(({ requirement, document }) => !requirement.required || document?.status === "approved")

// Consulta pública do CNPJ (Receita Federal) mostrada no topo da página do colaborador
export type CnpjFlag = {
  level: "danger" | "warning" | "info"
  title: string
  detail: string
}

export type CnpjReport = {
  cnpj: string
  legalName: string
  tradeName: string | null
  situation: string // ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA
  situationDate: string | null
  situationReason: string | null
  specialSituation: string | null
  openedAt: string | null
  size: string | null
  legalNature: string | null
  mainActivity: string | null
  capital: number | null // em reais
  regime: string
  branch: string | null // Matriz / Filial
  city: string | null
  state: string | null
  partners: { name: string; role: string | null; since: string | null }[]
  flags: CnpjFlag[]
  fetchedAt: string
}

export type CnpjReportResponse =
  | { status: "ok"; report: CnpjReport }
  | { status: "no_cnpj" | "not_found" | "unavailable" }
