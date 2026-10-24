import { createHash, randomBytes } from "node:crypto"

// Token opaco que vai no link do convite / cookie de sessão. No banco fica só o hash.
export function generateToken() {
  return randomBytes(32).toString("base64url")
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
