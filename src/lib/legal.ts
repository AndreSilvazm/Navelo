// Dados usados nos textos jurídicos (Termos de Uso e Política de Privacidade).
// Ao mudar o conteúdo dos textos, atualize LEGAL_VERSION: ela é gravada quando alguém aceita.
export const LEGAL = {
  brand: "Navelo",
  // data da versão vigente dos dois documentos (AAAA-MM-DD) e como aparece no texto
  version: "2026-10-24",
  updatedAt: "24 de outubro de 2026",
  // Preencher quando definidos. Enquanto vazios, os textos indicam os canais já existentes.
  // razão social e CNPJ da operadora da plataforma
  legalName: "",
  cnpj: "",
  // canal geral de contato
  contactEmail: "contato@navelo.com.br",
  // e-mail do encarregado pelo tratamento de dados pessoais (DPO)
  privacyEmail: "",
}

// canal para assuntos de privacidade: o do encarregado, se existir, senão o contato geral
export const PRIVACY_CHANNEL = LEGAL.privacyEmail || LEGAL.contactEmail

export const LEGAL_VERSION = LEGAL.version
