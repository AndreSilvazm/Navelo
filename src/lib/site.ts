import { IS_PRODUCTION } from "./app-env"

// Endereço público do site (usado em metadados, sitemap e links absolutos).
// Vazio ou inválido conta como ausente: num build sem a variável o site não pode quebrar.
function resolveSiteUrl() {
  const raw = process.env.APP_URL?.trim()
  if (raw) {
    try {
      return new URL(raw).origin
    } catch {
      /* cai no padrão abaixo */
    }
  }
  return "http://localhost:3000"
}

export const SITE_URL = resolveSiteUrl()

/** Prefixo do título da aba fora de produção, para ninguém confundir os ambientes */
export const TITLE_PREFIX = IS_PRODUCTION ? "" : "[Teste] "

export const SITE = {
  name: "Navelo",
  title: "Navelo — Gestão de colaboradores PJ",
  description:
    "Contratos, documentos, notas fiscais e pendências dos seus colaboradores PJ em uma plataforma simples e organizada. Portal da empresa e portal do colaborador.",
  keywords: ["gestão de colaboradores PJ", "contratos PJ", "notas fiscais", "documentos de colaboradores", "gestão de prestadores", "plataforma PJ"],
}
