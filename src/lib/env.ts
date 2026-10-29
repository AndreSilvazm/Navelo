import "server-only"

// Confere as variáveis de ambiente uma vez, no primeiro uso, e falha com uma mensagem clara.
// Melhor quebrar ao subir do que descobrir em produção que faltava um segredo.
function required(name: string, { minLength = 1, hint = "" } = {}) {
  const value = process.env[name]
  if (!value || value.length < minLength) {
    throw new Error(`Variável de ambiente ${name} ausente ou curta demais (mínimo ${minLength} caracteres).${hint ? ` ${hint}` : ""}`)
  }
  return value
}

// Segredo do servidor. Usado para derivar o hash dos tokens de sessão e de convite: quem obtiver
// uma cópia do banco não consegue transformar os hashes guardados em tokens válidos.
// Gere com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
export const AUTH_SECRET = (() => {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error(
      "Variável de ambiente AUTH_SECRET ausente ou com menos de 32 caracteres. " +
        `Gere uma com: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    )
  }
  return value
})()

export const DATABASE_URL = required("DATABASE_URL", { minLength: 10 })

// Em produção o site precisa saber o próprio endereço (links de convite, metadados, CSRF).
export const APP_URL = (process.env.APP_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000")).replace(/\/$/, "")
if (!APP_URL) throw new Error("Variável de ambiente APP_URL ausente: o endereço público do site é obrigatório em produção.")
