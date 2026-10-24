import "server-only"
import { formatDate } from "@/lib/format"
import type { CnpjFlag, CnpjReport, CnpjReportResponse } from "@/app/app/colaboradores/[id]/types"

type Declared = { legalName: string | null; zipCode: string | null }

// "Padaria São João Ltda." -> "PADARIA SAO JOAO LTDA"
const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

// Alertas a partir da consulta pública. Não substitui certidões: serve para a pessoa
// que analisa saber onde olhar com mais atenção.
function analyze(report: Omit<CnpjReport, "flags">, declared: Declared, raw: Record<string, unknown>): CnpjFlag[] {
  const flags: CnpjFlag[] = []

  if (report.situation !== "ATIVA") {
    const since = report.situationDate ? ` desde ${formatDate(report.situationDate)}` : ""
    const reason = report.situationReason ? ` Motivo: ${report.situationReason.toLowerCase()}.` : ""
    flags.push({
      level: "danger",
      title: `CNPJ com situação ${report.situation.toLowerCase()}`,
      detail: `Situação cadastral na Receita: ${report.situation}${since}.${reason} Não deveria ser contratado nessa situação.`,
    })
  }

  if (report.specialSituation) {
    flags.push({ level: "warning", title: "Situação especial", detail: `A Receita registra situação especial: ${report.specialSituation}.` })
  }

  if (report.openedAt) {
    const days = daysSince(report.openedAt)
    if (days < 180) flags.push({ level: "warning", title: "Empresa muito recente", detail: `Aberta em ${formatDate(report.openedAt)} (há ${days} dias).` })
    else if (days < 365) flags.push({ level: "info", title: "Menos de 1 ano de atividade", detail: `Aberta em ${formatDate(report.openedAt)}.` })
  }

  const simplesOut = raw.data_exclusao_do_simples as string | null
  if (simplesOut && raw.opcao_pelo_simples !== true) {
    flags.push({ level: "warning", title: "Excluída do Simples Nacional", detail: `Exclusão em ${formatDate(simplesOut)}.` })
  }
  const meiOut = raw.data_exclusao_do_mei as string | null
  if (meiOut && raw.opcao_pelo_mei !== true) {
    flags.push({ level: "warning", title: "Desenquadrada do MEI", detail: `Desenquadramento em ${formatDate(meiOut)}.` })
  }

  if (report.branch === "Filial") {
    flags.push({ level: "info", title: "CNPJ de filial", detail: "O CNPJ informado é de uma filial, não da matriz." })
  }

  // o que o colaborador digitou x o que consta na Receita
  if (declared.legalName) {
    const a = normalize(declared.legalName)
    const b = normalize(report.legalName)
    if (a && b && a !== b && !a.includes(b) && !b.includes(a)) {
      flags.push({
        level: "warning",
        title: "Razão social diferente da Receita",
        detail: `Informada: “${declared.legalName}”. Na Receita: “${report.legalName}”.`,
      })
    }
  }
  const zip = String(raw.cep ?? "")
  if (declared.zipCode && zip && declared.zipCode !== zip) {
    flags.push({ level: "info", title: "CEP diferente do cadastro na Receita", detail: `Informado: ${declared.zipCode}. Na Receita: ${zip}.` })
  }

  return flags
}

function regimeOf(d: Record<string, unknown>): string {
  if (d.opcao_pelo_mei === true) return "MEI"
  if (d.opcao_pelo_simples === true) return "Simples Nacional"
  const taxes = d.regime_tributario as { ano: number; forma_de_tributacao: string }[] | undefined
  const last = taxes?.length ? [...taxes].sort((a, b) => b.ano - a.ano)[0] : null
  return last ? `${last.forma_de_tributacao[0]}${last.forma_de_tributacao.slice(1).toLowerCase()} (${last.ano})` : "Não informado"
}

// Consulta pública (BrasilAPI). Dado público: por padrão fica em cache no servidor por 24 h.
export async function getCnpjReport(cnpj: string | null, declared: Declared, fresh = false): Promise<CnpjReportResponse> {
  if (!cnpj) return { status: "no_cnpj" }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { "User-Agent": "Navelo/1.0", Accept: "application/json" }, // sem User-Agent a BrasilAPI responde 403
      signal: AbortSignal.timeout(10_000),
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 86_400 } }),
    })
    if (res.status === 404) return { status: "not_found" }
    if (!res.ok) return { status: "unavailable" }

    const d = (await res.json()) as Record<string, unknown>
    const str = (k: string) => (typeof d[k] === "string" && d[k] ? (d[k] as string) : null)
    const reason = str("descricao_motivo_situacao_cadastral")

    const base: Omit<CnpjReport, "flags"> = {
      cnpj,
      legalName: str("razao_social") ?? "",
      tradeName: str("nome_fantasia"),
      situation: str("descricao_situacao_cadastral") ?? "DESCONHECIDA",
      situationDate: str("data_situacao_cadastral"),
      situationReason: reason && reason !== "SEM MOTIVO" ? reason : null,
      specialSituation: str("situacao_especial"),
      openedAt: str("data_inicio_atividade"),
      size: str("porte"),
      legalNature: str("natureza_juridica"),
      mainActivity: str("cnae_fiscal_descricao"),
      capital: typeof d.capital_social === "number" ? d.capital_social : null,
      regime: regimeOf(d),
      branch: str("descricao_identificador_matriz_filial") ? `${str("descricao_identificador_matriz_filial")![0]}${str("descricao_identificador_matriz_filial")!.slice(1).toLowerCase()}` : null,
      city: str("municipio"),
      state: str("uf"),
      partners: ((d.qsa as Record<string, string | null>[] | undefined) ?? []).map((p) => ({
        name: p.nome_socio ?? "—",
        role: p.qualificacao_socio ?? null,
        since: p.data_entrada_sociedade ?? null,
      })),
      fetchedAt: new Date().toISOString(),
    }

    return { status: "ok", report: { ...base, flags: analyze(base, declared, d) } }
  } catch {
    return { status: "unavailable" }
  }
}
