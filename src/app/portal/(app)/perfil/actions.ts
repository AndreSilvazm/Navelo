"use server"

import { revalidatePath } from "next/cache"
import { normalizeAccount, validateBank } from "@/lib/bank-validation"
import { syncBankData } from "@/lib/collaborator-join"
import { requireActiveCollaborator } from "@/lib/collaborators"

export type BankState = { error?: string; success?: string } | undefined

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim()

// O colaborador atualiza os próprios dados bancários (a conta é da empresa dele).
// Os dados da empresa (Receita Federal) não são editáveis aqui.
export async function updateBankData(_: BankState, formData: FormData): Promise<BankState> {
  const { session } = await requireActiveCollaborator()

  const values = {
    bankCode: text(formData, "bankCode"),
    bankName: text(formData, "bankName"),
    bankAgency: text(formData, "bankAgency"),
    bankAccount: text(formData, "bankAccount"),
    bankAccountType: text(formData, "bankAccountType"),
    pixKey: text(formData, "pixKey"),
  }
  const error = validateBank(values)
  if (error) return { error }

  // a conta bancária é única da pessoa: vale em todas as empresas dela
  await syncBankData(session.user.id, {
    bankCode: values.bankCode,
    bankName: values.bankName.slice(0, 120),
    bankAgency: values.bankAgency,
    bankAccount: normalizeAccount(values.bankAccount),
    bankAccountType: values.bankAccountType as "checking" | "savings", // já validado
    pixKey: values.pixKey || null,
  })

  revalidatePath("/portal/perfil")
  revalidatePath("/app/colaboradores/[id]", "page")
  return { success: "Dados bancários atualizados." }
}
