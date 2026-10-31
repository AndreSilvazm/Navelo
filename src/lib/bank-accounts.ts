import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { dbAdmin } from "@/db/admin"
import { bankAccounts, type BankAccount } from "@/db/schema"
import type { BankKind } from "@/lib/bank-labels"

/**
 * Contas bancárias da PESSOA (tabela bank_accounts), não do cadastro do colaborador:
 * - PJ: a conta da empresa dela (obrigatória no cadastro inicial);
 * - PF: a conta pessoal (opcional; dá para informar no cadastro ou depois, pelo perfil).
 * Valem em todas as empresas em que a pessoa trabalha.
 *
 * Leitura: pelo `db` (com RLS: a própria pessoa e o corporativo das empresas dela).
 * Escrita: só pelo `dbAdmin`, e só nos fluxos do servidor (cadastro inicial e pedido aprovado). O
 * usuário comum do app nem tem permissão de escrever nesta tabela.
 */
export { KIND_LABEL, isBankKind, type BankKind } from "@/lib/bank-labels"

export type BankAccountData = Pick<BankAccount, "bankCode" | "bankName" | "bankAgency" | "bankAccount" | "bankAccountType" | "pixKey">

export async function getBankAccounts(userId: string): Promise<{ pj: BankAccount | null; pf: BankAccount | null }> {
  const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId))
  return { pj: rows.find((r) => r.kind === "pj") ?? null, pf: rows.find((r) => r.kind === "pf") ?? null }
}

/** Cria ou troca a conta do tipo informado. Quem chama já validou os dados e decidiu que pode gravar. */
export async function saveBankAccount(userId: string, kind: BankKind, data: BankAccountData) {
  await dbAdmin
    .insert(bankAccounts)
    .values({ userId, kind, ...data })
    .onConflictDoUpdate({ target: [bankAccounts.userId, bankAccounts.kind], set: { ...data, updatedAt: new Date() } })
}

export async function removeBankAccount(userId: string, kind: BankKind) {
  await dbAdmin.delete(bankAccounts).where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.kind, kind)))
}

/** Os mesmos campos no formato que os formulários usam (sempre texto) */
export function toFormValues(account: BankAccount | null) {
  return {
    bankCode: account?.bankCode ?? "",
    bankName: account?.bankName ?? "",
    bankAgency: account?.bankAgency ?? "",
    bankAccount: account?.bankAccount ?? "",
    bankAccountType: account?.bankAccountType ?? "",
    pixKey: account?.pixKey ?? "",
  }
}
