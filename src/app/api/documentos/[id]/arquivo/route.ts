import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaborators } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"

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
      fileName: collaboratorDocuments.fileName,
      mimeType: collaboratorDocuments.mimeType,
      uploadedAt: collaboratorDocuments.uploadedAt,
    })
    .from(collaboratorDocuments)
    .innerJoin(collaborators, eq(collaborators.id, collaboratorDocuments.collaboratorId))
    .where(eq(collaboratorDocuments.id, id))
  if (!meta || meta.companyId !== session.company.id) return new Response("Não encontrado", { status: 404 })
  // colaborador só vê os próprios documentos
  if (!isCorporateRole(session.role) && meta.membershipId !== session.membershipId) return new Response("Não encontrado", { status: 404 })

  // reenviar o documento muda uploadedAt e, com isso, o ETag
  const etag = `"${id}-${meta.uploadedAt.getTime()}"`
  const cacheHeaders = { ETag: etag, "Cache-Control": "private, max-age=3600" }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cacheHeaders })

  const [file] = await db
    .select({ content: collaboratorDocuments.content })
    .from(collaboratorDocuments)
    .where(and(eq(collaboratorDocuments.id, id)))
  if (!file) return new Response("Não encontrado", { status: 404 })

  const disposition = new URL(req.url).searchParams.has("download") ? "attachment" : "inline"
  return new Response(new Uint8Array(file.content), {
    headers: {
      ...cacheHeaders,
      "Content-Type": meta.mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
