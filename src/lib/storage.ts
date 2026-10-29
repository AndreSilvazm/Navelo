import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Arquivos (documentos e notas fiscais) no Supabase Storage, não mais dentro do Postgres.
 *
 * Guardar arquivo em coluna bytea incha o backup, carrega o arquivo inteiro na memória a cada
 * leitura e deixa o restore lento. O bucket é **privado**: nada é servido direto por URL pública.
 * Quem quiser o arquivo passa pelas nossas rotas, que conferem o acesso e registram na auditoria.
 *
 * Sem as credenciais configuradas, a aplicação continua usando a coluna antiga — assim dá para
 * migrar sem parar nada.
 */
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "documentos"
const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() // segredo de servidor: nunca vai ao navegador

let client: SupabaseClient | null = null

export function storageEnabled() {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

/**
 * Que tipo de chave é: a chave-mestra do servidor ("service": service_role legada ou sb_secret_...)
 * ou a pública ("anon": anon legada ou sb_publishable_...)? A pública não consegue gravar no Storage,
 * e o Supabase responde apenas "new row violates row-level security policy". Reconhecer o tipo
 * permite dizer o problema real. Só olha o formato (e o papel dentro da chave legada), nunca a envia.
 */
export function keyKind(key: string | undefined = SERVICE_KEY): "service" | "anon" | "unknown" {
  if (!key) return "unknown"
  if (key.startsWith("sb_secret_")) return "service"
  if (key.startsWith("sb_publishable_")) return "anon"
  const partes = key.split(".")
  if (partes.length === 3) {
    try {
      const papel = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")).role
      if (papel === "service_role") return "service"
      if (papel === "anon" || papel === "authenticated") return "anon"
    } catch {
      /* não é uma chave no formato JWT */
    }
  }
  return "unknown"
}

export const ANON_KEY_MESSAGE =
  "A chave em SUPABASE_SERVICE_ROLE_KEY é a chave PÚBLICA (anon/publishable), que não pode gravar no Storage. " +
  "Use a service_role (aba legada) ou a Secret key (sb_secret_...) do projeto, em Project Settings > API Keys"

function storage() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Storage não configurado: faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
  }
  if (keyKind() === "anon") throw new Error(ANON_KEY_MESSAGE)
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  return client.storage.from(BUCKET)
}

// o Supabase responde "new row violates row-level security policy" quando a chave não pode gravar
const recusadoPorChave = (mensagem: string) => /row-level security|unauthorized|not authorized|invalid (jwt|api key)|forbidden/i.test(mensagem)
const AVISO_CHAVE = " (a chave do Storage não tem permissão de escrita: confira se SUPABASE_SERVICE_ROLE_KEY é a service_role/secret do MESMO projeto do SUPABASE_URL)"

const extensao = (mimeType: string) => (mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg")

/**
 * Caminho do documento de cadastro no bucket. A chave é a exigência (requirementId), não o
 * documento: reenviar o mesmo documento sobrescreve o arquivo em vez de deixar lixo para trás.
 */
export function documentPath(companyId: string, collaboratorId: string, requirementId: string, mimeType: string) {
  return `empresas/${companyId}/colaboradores/${collaboratorId}/documentos/${requirementId}.${extensao(mimeType)}`
}

/** Caminho da nota fiscal dentro do bucket */
export function invoicePath(companyId: string, collaboratorId: string, invoiceId: string, mimeType: string) {
  return `empresas/${companyId}/colaboradores/${collaboratorId}/notas/${invoiceId}.${extensao(mimeType)}`
}

export async function putFile(path: string, bytes: Buffer, contentType: string) {
  let { error } = await storage().upload(path, bytes, { contentType, upsert: true })
  // bucket ainda não criado neste projeto: cria (privado) e tenta de novo, uma vez
  if (error && /bucket not found|not found/i.test(error.message)) {
    await ensureBucket()
    ;({ error } = await storage().upload(path, bytes, { contentType, upsert: true }))
  }
  if (error) throw new Error(`Falha ao guardar o arquivo no storage: ${error.message}${recusadoPorChave(error.message) ? AVISO_CHAVE : ""}`)
  return path
}

/** Para o /api/health: o storage está configurado e o bucket existe? Nunca devolve a chave. */
export async function storageStatus(): Promise<{ enabled: boolean; ok?: boolean; detail?: string }> {
  if (!storageEnabled()) return { enabled: false }
  // a chave pública não grava no Storage: dá para saber só pelo formato, sem chamar a rede
  if (keyKind() === "anon") return { enabled: true, ok: false, detail: ANON_KEY_MESSAGE }
  try {
    client ??= createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const { data, error } = await client.storage.getBucket(BUCKET)
    if (data) return { enabled: true, ok: true, detail: data.public ? "bucket PÚBLICO (deveria ser privado)" : undefined }
    const msg = error?.message ?? ""
    if (/not found/i.test(msg)) return { enabled: true, ok: false, detail: `o bucket "${BUCKET}" não existe (é criado no primeiro envio, ou rode npm run files:migrate -- --apply)` }
    if (recusadoPorChave(msg)) return { enabled: true, ok: false, detail: "chave do Supabase recusada: SUPABASE_SERVICE_ROLE_KEY é de outro projeto, inválida, ou é a chave pública em vez da service_role/secret" }
    return { enabled: true, ok: false, detail: msg.slice(0, 160) || "erro ao consultar o storage" }
  } catch (e) {
    return { enabled: true, ok: false, detail: e instanceof Error ? e.message.slice(0, 160) : "erro ao consultar o storage" }
  }
}

export async function getFile(path: string): Promise<Buffer> {
  const { data, error } = await storage().download(path)
  if (error || !data) throw new Error(`Falha ao ler o arquivo: ${error?.message ?? "vazio"}`)
  return Buffer.from(await data.arrayBuffer())
}

export async function removeFile(path: string) {
  const { error } = await storage().remove([path])
  if (error) console.error("storage remove", path, error.message)
}

/** Cria o bucket privado, se ainda não existir (usado pelo script de migração) */
export async function ensureBucket() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Storage não configurado.")
  if (keyKind() === "anon") throw new Error(ANON_KEY_MESSAGE)
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data } = await client.storage.getBucket(BUCKET)
  if (data) return { criado: false, bucket: BUCKET }
  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024, // o mesmo limite por arquivo que a aplicação aplica
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  })
  if (error) throw new Error(`Falha ao criar o bucket: ${error.message}${recusadoPorChave(error.message) ? AVISO_CHAVE : ""}`)
  return { criado: true, bucket: BUCKET }
}
