import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaborators, documentRequirements } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"
import { auditFromSession } from "@/lib/audit"
import { fileHeaders, readStoredFile } from "@/lib/file-serving"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Arquivo de um documento de cadastro: o colaborador que o enviou e o corporativo da mesma empresa.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response("Não autorizado", { status: 401 })

  const { id } = await ctx.params
  if (!UUID.test(id)) return new Response("Não encontrado", { status: 404 })

  // 1ª consulta só com metadados (leve): valida o acesso e o cache do navegador
  const [meta] = await db
    .select({
      collaboratorId: collaborators.id,
      companyId: collaborators.companyId,
      membershipId: collaborators.membershipId,
      requirementName: documentRequirements.name,
      fileName: collaboratorDocuments.fileName,
      mimeType: collaboratorDocuments.mimeType,
      uploadedAt: collaboratorDocuments.uploadedAt,
    })
    .from(collaboratorDocuments)
    .innerJoin(collaborators, eq(collaborators.id, collaboratorDocuments.collaboratorId))
    .innerJoin(documentRequirements, eq(documentRequirements.id, collaboratorDocuments.requirementId))
    .where(eq(collaboratorDocuments.id, id))
  if (!meta || meta.companyId !== session.company.id) return new Response("Não encontrado", { status: 404 })
  // colaborador só vê os próprios documentos
  if (!isCorporateRole(session.role) && meta.membershipId !== session.membershipId) return new Response("Não encontrado", { status: 404 })

  // reenviar o documento muda uploadedAt e, com isso, o ETag
  const etag = `"${id}-${meta.uploadedAt.getTime()}"`
  // Registro antes do cache: mesmo quando o navegador só revalida (304), a visualização aparece
  // na trilha. Por isso o arquivo é servido com "no-cache" — revalida sempre, sem reenviar bytes.
  const baixando = new URL(req.url).searchParams.has("download")
  await auditFromSession(session, {
    action: baixando ? "document.downloaded" : "document.viewed",
    targetType: "document",
    targetId: id,
    targetLabel: meta.requirementName,
    details: { arquivo: meta.fileName, colaboradorId: meta.collaboratorId },
  })

  const cacheHeaders = { ETag: etag, "Cache-Control": "private, no-cache" }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cacheHeaders })

  const [row] = await db
    .select({ storagePath: collaboratorDocuments.storagePath, content: collaboratorDocuments.content })
    .from(collaboratorDocuments)
    .where(and(eq(collaboratorDocuments.id, id)))
  const file = row ? await readStoredFile(row) : null
  if (!file) return new Response("Não encontrado", { status: 404 })

  return new Response(new Uint8Array(file), {
    headers: fileHeaders({ fileName: meta.fileName, mimeType: meta.mimeType, baixando, etag }),
  })
}
