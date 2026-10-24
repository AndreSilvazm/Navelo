import "server-only"
import { titleCase } from "@/lib/format"

// Campos do cadastro da empresa que vêm da Receita Federal. O que a Receita informa
// não pode ser alterado pelo colaborador.
export const COMPANY_FIELDS = [
  "legalName",
  "tradeName",
  "phone",
  "zipCode",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
] as const
export type CompanyField = (typeof COMPANY_FIELDS)[number]

export type CompanyProfile = Record<CompanyField, string> & { situation: string }
export type CompanyLookup = { status: "ok"; data: CompanyProfile } | { status: "not_found" | "unavailable" }

// Consulta pública (BrasilAPI). Dado público: fica em cache no servidor por 24 h.
export async function fetchCompanyProfile(cnpj: string): Promise<CompanyLookup> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { "User-Agent": "Navelo/1.0", Accept: "application/json" }, // sem User-Agent a BrasilAPI responde 403
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (res.status === 404) return { status: "not_found" }
    if (!res.ok) return { status: "unavailable" }

    const d = await res.json()
    const street = [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ")
    return {
      status: "ok",
      data: {
        legalName: d.razao_social ?? "",
        tradeName: d.nome_fantasia ? titleCase(d.nome_fantasia) : "",
        phone: String(d.ddd_telefone_1 ?? ""),
        zipCode: String(d.cep ?? ""),
        street: street ? titleCase(street) : "",
        number: d.numero ? titleCase(String(d.numero)) : "",
        complement: d.complemento ? titleCase(d.complemento) : "",
        district: d.bairro ? titleCase(d.bairro) : "",
        city: d.municipio ? titleCase(d.municipio) : "",
        state: d.uf ?? "",
        situation: d.descricao_situacao_cadastral ?? "",
      },
    }
  } catch {
    return { status: "unavailable" }
  }
}
