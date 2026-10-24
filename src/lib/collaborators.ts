import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { collaboratorDocuments, collaborators, documentRequirements, users, type Collaborator } from "@/db/schema"
import { requireSession } from "@/lib/auth/session"

export const ONBOARDING_PATH = "/portal/primeiro-acesso"

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const

// O tipo informado pelo navegador não é confiável: confere os primeiros bytes
export function detectMimeType(bytes: Buffer): (typeof ALLOWED_MIME_TYPES)[number] | null {
  if (bytes.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf"
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png"
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg"
  return null
}

// Todo vínculo de colaborador tem um registro; cria na hora se ainda não existir
export async function ensureCollaborator(membershipId: string, companyId: string): Promise<Collaborator> {
  // caso comum: já existe, uma consulta só
  const [existing] = await db.select().from(collaborators).where(eq(collaborators.membershipId, membershipId))
  if (existing) return existing

  await db.insert(collaborators).values({ membershipId, companyId }).onConflictDoNothing({
    target: collaborators.membershipId,
  })
  const [row] = await db.select().from(collaborators).where(eq(collaborators.membershipId, membershipId))
  return row
}

const loadCollaborator = cache((membershipId: string, companyId: string) =>
  ensureCollaborator(membershipId, companyId),
)

// Áreas do portal para colaborador já liberado. Quem ainda está no onboarding
// não vê nem faz mais nada além do primeiro acesso.
export async function requireActiveCollaborator() {
  const session = await requireSession("collaborator")
  const collaborator = await loadCollaborator(session.membershipId, session.company.id)
  if (collaborator.status !== "active") redirect(ONBOARDING_PATH)
  return { session, collaborator }
}

// Tela de primeiro acesso: só para quem ainda não está ativo
export async function requireOnboardingCollaborator() {
  const session = await requireSession("collaborator")
  const collaborator = await loadCollaborator(session.membershipId, session.company.id)
  if (collaborator.status === "active") redirect("/portal")
  return { session, collaborator }
}

// Exigências vigentes da empresa + o arquivo enviado (sem o conteúdo)
export async function getDocumentChecklist(collaboratorId: string, companyId: string) {
  const rows = await db
    .select({
      requirement: {
        id: documentRequirements.id,
        name: documentRequirements.name,
        description: documentRequirements.description,
        required: documentRequirements.required,
      },
      document: {
        id: collaboratorDocuments.id,
        fileName: collaboratorDocuments.fileName,
        mimeType: collaboratorDocuments.mimeType,
        sizeBytes: collaboratorDocuments.sizeBytes,
        status: collaboratorDocuments.status,
        reviewNote: collaboratorDocuments.reviewNote,
        uploadedAt: collaboratorDocuments.uploadedAt,
        reviewedAt: collaboratorDocuments.reviewedAt,
      },
      // fora do objeto do documento: assim ele continua "inteiro ou nulo" no tipo
      reviewedBy: users.name,
    })
    .from(documentRequirements)
    .leftJoin(
      collaboratorDocuments,
      and(
        eq(collaboratorDocuments.requirementId, documentRequirements.id),
        eq(collaboratorDocuments.collaboratorId, collaboratorId),
      ),
    )
    .leftJoin(users, eq(users.id, collaboratorDocuments.reviewedByUserId))
    .where(and(eq(documentRequirements.companyId, companyId), isNull(documentRequirements.archivedAt)))
    .orderBy(asc(documentRequirements.createdAt))

  return rows.map(({ requirement, document, reviewedBy }) => ({
    requirement,
    document: document ? { ...document, reviewedBy } : null,
  }))
}

export type ChecklistItem = Awaited<ReturnType<typeof getDocumentChecklist>>[number]

// Pode enviar para análise: todo documento obrigatório enviado e não recusado
export function readyForReview(items: ChecklistItem[]) {
  return items.every(
    ({ requirement, document }) => !requirement.required || (document && document.status !== "rejected"),
  )
}

// Pode ser liberado: todo documento obrigatório aprovado
export function readyForApproval(items: ChecklistItem[]) {
  return items.every(({ requirement, document }) => !requirement.required || document?.status === "approved")
}
