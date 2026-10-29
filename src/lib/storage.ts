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
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documentos"
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // segredo de servidor: nunca vai ao navegador

let client: SupabaseClient | null = null

export function storageEnabled() {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

function storage() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Storage não configurado: faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
  }
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  return client.storage.from(BUCKET)
}

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
  if (error) throw new Error(`Falha ao guardar o arquivo no storage: ${error.message}`)
  return path
}

/** Para o /api/health: o storage está configurado e o bucket existe? Nunca devolve a chave. */
export async function storageStatus(): Promise<{ enabled: boolean; ok?: boolean; detail?: string }> {
  if (!storageEnabled()) return { enabled: false }
  try {
    client ??= createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const { data, error } = await client.storage.getBucket(BUCKET)
    if (data) return { enabled: true, ok: true, detail: data.public ? "bucket PÚBLICO (deveria ser privado)" : undefined }
    const msg = error?.message ?? ""
    if (/not found/i.test(msg)) return { enabled: true, ok: false, detail: `o bucket "${BUCKET}" não existe (é criado no primeiro envio, ou rode npm run files:migrate -- --apply)` }
    if (/invalid|jwt|unauthor|api key|forbidden|401|403/i.test(msg)) return { enabled: true, ok: false, detail: "chave do Supabase recusada (SUPABASE_SERVICE_ROLE_KEY de outro projeto ou inválida?)" }
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
  client ??= createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data } = await client.storage.getBucket(BUCKET)
  if (data) return { criado: false, bucket: BUCKET }
  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024, // o mesmo limite por arquivo que a aplicação aplica
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
  })
  if (error) throw new Error(`Falha ao criar o bucket: ${error.message}`)
  return { criado: true, bucket: BUCKET }
}
