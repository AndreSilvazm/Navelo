import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { contractFiles } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"
import { auditFromSession } from "@/lib/audit"
import { fileHeaders, readStoredFile } from "@/lib/file-serving"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Arquivo anexado ao contrato: só o corporativo da mesma empresa. Toda abertura entra na auditoria.
export async function GET(req: Request, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await getSession()
  if (!session) return new Response("Não autorizado", { status: 401 })
  if (!isCorporateRole(session.role)) return new Response("Não encontrado", { status: 404 })

  const { id, fileId } = await ctx.params
  if (!UUID.test(id) || !UUID.test(fileId)) return new Response("Não encontrado", { status: 404 })

  const [file] = await db
    .select()
    .from(contractFiles)
    .where(and(eq(contractFiles.id, fileId), eq(contractFiles.contractId, id), eq(contractFiles.companyId, session.company.id)))
  if (!file) return new Response("Não encontrado", { status: 404 })

  const baixando = new URL(req.url).searchParams.has("download")
  await auditFromSession(session, {
    action: baixando ? "contract_file.downloaded" : "contract_file.viewed",
    targetType: "contract_file",
    targetId: fileId,
    targetLabel: file.title,
    details: { arquivo: file.fileName, contratoId: id },
  })

  // o arquivo nunca muda; o ETag acompanha a data do anexo
  const etag = `"${fileId}-${file.createdAt.getTime()}"`
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-cache" } })

  const bytes = await readStoredFile({ storagePath: file.storagePath, content: null })
  if (!bytes) return new Response("Não encontrado", { status: 404 })

  return new Response(new Uint8Array(bytes), {
    headers: fileHeaders({ fileName: file.fileName, mimeType: file.mimeType, baixando, etag }),
  })
}
