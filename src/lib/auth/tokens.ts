import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { AUTH_SECRET } from "@/lib/env"

// Token opaco que vai no link do convite / cookie de sessão. No banco fica só o hash.
export function generateToken() {
  return randomBytes(32).toString("base64url")
}

// HMAC com o segredo do servidor: uma cópia do banco não basta para forjar um token válido,
// porque o segredo não está lá.
export function hashToken(token: string) {
  return createHmac("sha256", AUTH_SECRET).update(token).digest("hex")
}

// Formato antigo (sha256 puro), usado só para aceitar convites criados antes do AUTH_SECRET.
export function legacyHashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

/** Comparação de strings em tempo constante (não vaza o tamanho do prefixo correto) */
export function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
