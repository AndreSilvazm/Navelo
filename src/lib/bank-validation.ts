// Validação dos dados bancários (cadastro inicial e perfil). A conta é da empresa do colaborador.
export type BankInput = {
  bankCode: string
  bankName: string
  bankAgency: string
  bankAccount: string
  bankAccountType: string
  pixKey: string
}

// devolve a mensagem de erro, ou null se estiver tudo certo
export function validateBank(v: BankInput): string | null {
  if (!/^\d{3}$/.test(v.bankCode)) return "Informe o código do banco (3 dígitos)."
  if (v.bankName.length < 2) return "Informe o nome do banco."
  if (!/^\d{1,5}$/.test(v.bankAgency)) return "Agência inválida (somente números)."
  if (!/^\d{1,12}-?[\dX]$/i.test(v.bankAccount)) return "Conta inválida. Informe número e dígito, ex.: 12345-6."
  if (v.bankAccountType !== "checking" && v.bankAccountType !== "savings") return "Escolha o tipo da conta."
  if (v.pixKey.length > 77) return "Chave PIX muito longa."
  return null
}

// "123456" -> "12345-6"
export const normalizeAccount = (account: string) => account.toUpperCase().replace(/^(\d+)-?(\d|X)$/, "$1-$2")
