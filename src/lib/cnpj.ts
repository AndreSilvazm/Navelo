export const onlyDigits = (value: string) => value.replace(/\D/g, "")

export function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

// Valida os dois dígitos verificadores
export function isValidCnpj(input: string) {
  const cnpj = onlyDigits(input)
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false

  const digit = (base: string) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = [...base].reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const d1 = digit(cnpj.slice(0, 12))
  const d2 = digit(cnpj.slice(0, 12) + d1)
  return cnpj.endsWith(`${d1}${d2}`)
}
