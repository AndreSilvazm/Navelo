import { IS_PRODUCTION } from "./app-env"

// Endereço público do site (usado em metadados, sitemap e links absolutos).
export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")

/** Prefixo do título da aba fora de produção, para ninguém confundir os ambientes */
export const TITLE_PREFIX = IS_PRODUCTION ? "" : "[Teste] "

export const SITE = {
  name: "Navelo",
  title: "Navelo — Gestão de colaboradores PJ",
  description:
    "Contratos, documentos, notas fiscais e pendências dos seus colaboradores PJ em uma plataforma simples e organizada. Portal da empresa e portal do colaborador.",
  keywords: ["gestão de colaboradores PJ", "contratos PJ", "notas fiscais", "documentos de colaboradores", "gestão de prestadores", "plataforma PJ"],
}
