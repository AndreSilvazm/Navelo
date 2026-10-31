import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, reimbursementFiles, reimbursements } from "@/db/schema"
import { getSession, isCorporateRole } from "@/lib/auth/session"
import { auditFromSession } from "@/lib/audit"
import { fileHeaders, readStoredFile } from "@/lib/file-serving"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Comprovante do reembolso: quem pediu (o colaborador) e o corporativo da mesma empresa.
export async function GET(req: Request, ctx: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await getSession()
  if (!session) return new Response("Não autorizado", { status: 401 })

  const { id, fileId } = await ctx.params
  if (!UUID.test(id) || !UUID.test(fileId)) return new Response("Não encontrado", { status: 404 })

  const [row] = await db
    .select({ file: reimbursementFiles, collaboratorId: reimbursements.collaboratorId, description: reimbursements.description })
    .from(reimbursementFiles)
    .innerJoin(reimbursements, eq(reimbursements.id, reimbursementFiles.reimbursementId))
    .where(
      and(
        eq(reimbursementFiles.id, fileId),
        eq(reimbursementFiles.reimbursementId, id),
        eq(reimbursementFiles.companyId, session.company.id),
        eq(reimbursements.companyId, session.company.id),
      ),
    )
  if (!row) return new Response("Não encontrado", { status: 404 })

  if (!isCorporateRole(session.role)) {
    // colaborador só vê os comprovantes dos próprios pedidos
    const [own] = await db
      .select({ id: collaborators.id })
      .from(collaborators)
      .where(and(eq(collaborators.id, row.collaboratorId), eq(collaborators.membershipId, session.membershipId)))
    if (!own) return new Response("Não encontrado", { status: 404 })
  }

  const { file } = row
  const baixando = new URL(req.url).searchParams.has("download")
  await auditFromSession(session, {
    action: baixando ? "reimbursement.downloaded" : "reimbursement.viewed",
    targetType: "reimbursement",
    targetId: id,
    targetLabel: row.description.slice(0, 80),
    details: { arquivo: file.fileName, colaboradorId: row.collaboratorId },
  })

  const etag = `"${fileId}-${file.createdAt.getTime()}"`
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-cache" } })

  const bytes = await readStoredFile({ storagePath: file.storagePath, content: null })
  if (!bytes) return new Response("Não encontrado", { status: 404 })

  return new Response(new Uint8Array(bytes), {
    headers: fileHeaders({ fileName: file.fileName, mimeType: file.mimeType, baixando, etag }),
  })
}
