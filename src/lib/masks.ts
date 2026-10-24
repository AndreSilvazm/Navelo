const digits = (v: string) => v.replace(/\D/g, "")

export function maskCnpj(value: string) {
  const d = digits(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

// (11) 91234-5678 ou (11) 1234-5678
export function maskPhone(value: string) {
  const d = digits(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ""
  const rest = d.slice(2)
  const split = d.length > 10 ? 5 : 4
  return `(${d.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? `-${rest.slice(split)}` : ""}`
}

export function maskCep(value: string) {
  const d = digits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// 123456 -> "1.234,56" (digita-se só números; os dois últimos são os centavos)
export function maskCurrency(value: string) {
  const d = digits(value).replace(/^0+/, "").slice(0, 12)
  if (!d) return ""
  const padded = d.padStart(3, "0")
  const cents = padded.slice(-2)
  const int = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${int},${cents}`
}

// agência: só números (até 5)
export const maskAgency = (value: string) => digits(value).slice(0, 5)

// conta: números com o dígito verificador separado por hífen (12345-6)
export function maskAccount(value: string) {
  const d = value.replace(/[^\dxX]/g, "").toUpperCase().slice(0, 13)
  return d.length > 1 ? `${d.slice(0, -1)}-${d.slice(-1)}` : d
}

export const maskBankCode = (value: string) => digits(value).slice(0, 3)

export const masks = {
  cnpj: maskCnpj,
  phone: maskPhone,
  cep: maskCep,
  currency: maskCurrency,
  agency: maskAgency,
  account: maskAccount,
  bankCode: maskBankCode,
}
export type MaskName = keyof typeof masks
