import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaborators } from "@/db/schema"
import { requireSession } from "@/lib/auth/session"

// Download do documento enviado pelo colaborador — só para o corporativo da mesma empresa
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSession("corporate")
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Não encontrado", { status: 404 })

  // 1ª consulta só com metadados (leve): serve para validar o cache do navegador
  const [meta] = await db
    .select({
      fileName: collaboratorDocuments.fileName,
      mimeType: collaboratorDocuments.mimeType,
      uploadedAt: collaboratorDocuments.uploadedAt,
    })
    .from(collaboratorDocuments)
    .innerJoin(collaborators, eq(collaborators.id, collaboratorDocuments.collaboratorId))
    .where(and(eq(collaboratorDocuments.id, id), eq(collaborators.companyId, session.company.id)))

  if (!meta) return new Response("Não encontrado", { status: 404 })

  // reenviar o arquivo muda uploadedAt, e com isso o ETag
  const etag = `"${id}-${meta.uploadedAt.getTime()}"`
  // privado (documento sensível) e por pouco tempo; nada de cache compartilhado
  const cacheHeaders = { ETag: etag, "Cache-Control": "private, max-age=3600" }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cacheHeaders })

  const [file] = await db
    .select({ content: collaboratorDocuments.content })
    .from(collaboratorDocuments)
    .where(eq(collaboratorDocuments.id, id))
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
