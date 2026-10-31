import "server-only"
import { headers } from "next/headers"
import { isIP } from "node:net"
import { dbAdmin as db } from "@/db/admin"
import { auditEvents } from "@/db/schema"
import type { AuthSession } from "@/lib/auth/session"

/**
 * Ações registradas na trilha de auditoria. A lista é fechada de propósito: assim ninguém
 * inventa um nome novo por engano e os relatórios continuam fazendo sentido.
 */
export type AuditAction =
  // arquivos: quem abriu e quem baixou
  | "document.viewed"
  | "document.downloaded"
  | "invoice.viewed"
  | "invoice.downloaded"
  // conta bancária
  | "bank_change.requested"
  | "bank_change.approved"
  | "bank_change.rejected"
  | "bank_change.canceled"
  // análise do cadastro
  | "collaborator.approved"
  | "collaborator.rejected"
  | "collaborator.suspended"
  | "collaborator.reactivated"
  | "collaborator.reopened"
  | "document.approved"
  | "document.rejected"
  // notas fiscais
  | "invoice.approved"
  | "invoice.rejected"
  | "invoice.paid"
  // reembolsos
  | "reimbursement.approved"
  | "reimbursement.rejected"
  | "reimbursement.paid"
  | "reimbursement.viewed"
  | "reimbursement.downloaded"
  // arquivos do contrato
  | "contract_file.uploaded"
  | "contract_file.deleted"
  | "contract_file.viewed"
  | "contract_file.downloaded"
  // contrato
  | "contract.ended"
  // dinheiro e acesso
  | "collaborator.amount_changed"
  | "password.changed"

export type AuditTargetType = "collaborator" | "document" | "invoice" | "bank_change" | "user" | "reimbursement" | "contract" | "contract_file"

type AuditInput = {
  action: AuditAction
  companyId?: string | null
  actor?: { id: string; name: string; role: string } | null
  targetType?: AuditTargetType
  targetId?: string
  /** rótulo legível do alvo (nome do colaborador, nº da nota) para o registro se bastar sozinho */
  targetLabel?: string | null
  details?: Record<string, unknown>
}

/**
 * Grava um evento. Nunca derruba a ação que o gerou: se o registro falhar, o erro vai para o
 * console do servidor e a operação segue. (Trilha é importante, mas não vale travar um pagamento.)
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
    await db.insert(auditEvents).values({
      companyId: input.companyId ?? null,
      actorUserId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? null,
      actorRole: input.actor?.role ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      details: input.details ?? null,
      ipAddress: forwarded && isIP(forwarded) ? forwarded : null,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    })
  } catch (error) {
    console.error("audit", input.action, error)
  }
}

/** Atalho para quem já tem a sessão em mãos */
export function auditFromSession(session: AuthSession, input: Omit<AuditInput, "companyId" | "actor">) {
  return audit({
    ...input,
    companyId: session.company.id,
    actor: { id: session.user.id, name: session.user.name, role: session.role },
  })
}

/** Só os campos que importam da conta bancária, para registrar o "de" e o "para" */
export function bankSnapshot(row: {
  bankCode?: string | null
  bankName?: string | null
  bankAgency?: string | null
  bankAccount?: string | null
  bankAccountType?: string | null
  pixKey?: string | null
}) {
  return {
    banco: row.bankCode ? `${row.bankCode} · ${row.bankName ?? ""}`.trim() : null,
    agencia: row.bankAgency ?? null,
    conta: row.bankAccount ?? null,
    tipo: row.bankAccountType === "savings" ? "poupança" : row.bankAccountType === "checking" ? "corrente" : null,
    pix: row.pixKey ?? null,
  }
}
