import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, invoices } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"
import { auditFromSession } from "@/lib/audit"
import { fileHeaders, readStoredFile } from "@/lib/file-serving"

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
      number: invoices.number,
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
  // Registro antes do cache: mesmo quando o navegador só revalida (304), a visualização aparece
  // na trilha. Por isso o arquivo é servido com "no-cache" — revalida sempre, sem reenviar bytes.
  const baixando = new URL(req.url).searchParams.has("download")
  await auditFromSession(session, {
    action: baixando ? "invoice.downloaded" : "invoice.viewed",
    targetType: "invoice",
    targetId: id,
    targetLabel: `nº ${meta.number}`,
    details: { arquivo: meta.fileName, colaboradorId: meta.collaboratorId },
  })

  const cacheHeaders = { ETag: etag, "Cache-Control": "private, no-cache" }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cacheHeaders })

  const [row] = await db
    .select({ storagePath: invoices.storagePath, content: invoices.content })
    .from(invoices)
    .where(eq(invoices.id, id))
  const file = row ? await readStoredFile(row) : null
  if (!file) return new Response("Não encontrado", { status: 404 })

  return new Response(new Uint8Array(file), {
    headers: fileHeaders({ fileName: meta.fileName, mimeType: meta.mimeType, baixando, etag }),
  })
}
