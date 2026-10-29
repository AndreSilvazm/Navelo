import { createHash } from "node:crypto"
import { hash, verify } from "@node-rs/argon2"
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password-rules"

// argon2id com os parâmetros mínimos recomendados pela OWASP
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 }


export function hashPassword(password: string) {
  return hash(password, options)
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

// Senhas óbvias que aparecem em qualquer lista de ataque, inclusive as brasileiras.
const COMMON = new Set([
  "senha", "senha123", "123456", "1234567", "12345678", "123456789", "1234567890", "password", "qwerty", "abc123",
  "brasil", "mudar123", "admin123", "teste123", "colaborador", "navelo", "navelo123", "12345", "111111", "iloveyou",
])

/**
 * A senha vazou em algum ataque conhecido? Pergunta ao Have I Been Pwned sem enviar a senha:
 * manda só os 5 primeiros caracteres do hash SHA-1 e procura o resto na lista que volta
 * (k-anonymity). Se o serviço estiver fora do ar, deixa passar — não dá para travar o cadastro
 * de todo mundo por causa de uma dependência externa.
 */
async function isLeaked(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "User-Agent": "Navelo/1.0", "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.split("\n").some((line) => line.slice(0, 35).trim() === suffix)
  } catch {
    return false
  }
}

/** Pedaços do nome e do e-mail que não podem virar senha (ex.: "andre", "simao", "acme") */
function personalTerms(input: { email?: string; name?: string }) {
  const fromEmail = (input.email ?? "").toLowerCase().split("@")
  return [...(input.name ?? "").toLowerCase().split(/\s+/), fromEmail[0] ?? "", (fromEmail[1] ?? "").split(".")[0] ?? ""]
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter((term) => term.length >= 4)
}

/** Devolve a mensagem do problema, ou null se a senha serve. */
export async function validatePassword(password: string, owner: { email?: string; name?: string } = {}): Promise<string | null> {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (password.length > MAX_PASSWORD_LENGTH) return "Senha longa demais (máximo 128 caracteres)."

  const plain = password.toLowerCase()
  if (COMMON.has(plain)) return "Essa senha é muito comum. Escolha outra."
  if (/^(.)\1+$/.test(password)) return "Não use um único caractere repetido."
  if (/^(?:0123456789|1234567890|abcdefghij)/.test(plain)) return "Não use uma sequência óbvia de teclado."
  if (personalTerms(owner).some((term) => plain.includes(term))) return "A senha não pode conter seu nome nem seu e-mail."
  if (await isLeaked(password)) return "Essa senha já apareceu em vazamentos conhecidos. Escolha outra."

  return null
}
