// Tipos e rótulos das contas bancárias. Sem nada de servidor: o arquivo também vai para o navegador.
export type BankKind = "pj" | "pf"

export const isBankKind = (value: string): value is BankKind => value === "pj" || value === "pf"

export const KIND_LABEL: Record<BankKind, string> = {
  pj: "Conta PJ (da empresa)",
  pf: "Conta pessoa física",
}
