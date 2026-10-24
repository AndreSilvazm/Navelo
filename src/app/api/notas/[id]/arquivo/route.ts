import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, invoices } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Arquivo da nota fiscal: quem enviou (o colaborador) e o corporativo da mesma empresa.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return new Response("Não autorizado", { status: 401 })

  const { id } = await ctx.params
  if (!UUID.test(id)) return new Response("Não encontrado", { status: 404 })

  // 1ª consulta só com metadados (leve): valida o acesso e o cache do navegador
  const [meta] = await db
    .select({
      companyId: invoices.companyId,
      collaboratorId: invoices.collaboratorId,
      fileName: invoices.fileName,
      mimeType: invoices.mimeType,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.id, id))
  if (!meta || meta.companyId !== session.company.id) return new Response("Não encontrado", { status: 404 })

  if (!isCorporateRole(session.role)) {
    // colaborador só vê as próprias notas
    const [own] = await db
      .select({ id: collaborators.id })
      .from(collaborators)
      .where(and(eq(collaborators.id, meta.collaboratorId), eq(collaborators.membershipId, session.membershipId)))
    if (!own) return new Response("Não encontrado", { status: 404 })
  }

  // o arquivo da nota nunca muda; o ETag acompanha a data do cadastro
  const etag = `"${id}-${meta.createdAt.getTime()}"`
  const cacheHeaders = { ETag: etag, "Cache-Control": "private, max-age=3600" }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cacheHeaders })

  const [file] = await db.select({ content: invoices.content }).from(invoices).where(eq(invoices.id, id))
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
