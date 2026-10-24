import { hash, verify } from "@node-rs/argon2"

// argon2id com os parâmetros mínimos recomendados pela OWASP
const options = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

export const MIN_PASSWORD_LENGTH = 8

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
