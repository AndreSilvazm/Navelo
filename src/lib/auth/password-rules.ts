// Regras de senha que o navegador também precisa conhecer (textos de ajuda).
// Fica separado de password.ts porque aquele carrega o argon2, que só roda no servidor.

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128

/** validade do link de troca de senha, em minutos */
export const RESET_TTL_MINUTES = 60

export const PASSWORD_HINT = `Mínimo de ${MIN_PASSWORD_LENGTH} caracteres. Não pode conter seu nome ou e-mail, nem ser uma senha conhecida de vazamentos.`
