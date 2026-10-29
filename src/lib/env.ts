import "server-only"

// Variáveis de ambiente de execução, conferidas no PRIMEIRO USO e não ao importar o arquivo.
//
// Por quê: o `next build` importa todos os arquivos das rotas para coletar a configuração. Se a
// validação rodasse no import, o build exigiria os segredos, e quem faz o build (pipeline, imagem
// Docker) não deve conhecê-los. Segredo existe só onde a aplicação roda. Se faltar, o erro é claro
// e acontece na primeira requisição que precisar dele, não numa falha obscura de build.

let authSecret: string | undefined

/**
 * Segredo do servidor, usado para derivar o hash dos tokens de sessão e de convite: quem obtiver
 * uma cópia do banco não consegue transformar os hashes guardados em tokens válidos.
 * Gere com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
 */
export function getAuthSecret(): string {
  if (authSecret) return authSecret
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error(
      "Variável de ambiente AUTH_SECRET ausente ou com menos de 32 caracteres. " +
        `Gere uma com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    )
  }
  return (authSecret = value)
}

/** Endereço público do site, sem barra no fim (links de convite e de troca de senha). */
export function getAppUrl(): string {
  const value = process.env.APP_URL?.trim() || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")
  if (!value) throw new Error("Variável de ambiente APP_URL ausente: o endereço público do site é obrigatório em produção.")
  return value.replace(/\/$/, "")
}
