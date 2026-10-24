// "Maria da Silva" ok; "Maria" ou "FalkeX" não: pede nome e sobrenome
export function isFullName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.filter((w) => w.length >= 2).length >= 2
}

export const FULL_NAME_ERROR = "Informe o nome completo (nome e sobrenome)."
