// Endereço público do site (usado em metadados, sitemap e links absolutos).
export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")

export const SITE = {
  name: "Navelo",
  title: "Navelo — Gestão de colaboradores PJ",
  description:
    "Contratos, documentos, notas fiscais e pendências dos seus colaboradores PJ em uma plataforma simples e organizada. Portal da empresa e portal do colaborador.",
  keywords: ["gestão de colaboradores PJ", "contratos PJ", "notas fiscais", "documentos de colaboradores", "gestão de prestadores", "plataforma PJ"],
}
