import type { Metadata } from "next"
import { PageHeading } from "@/figma/ui"
import { getDocumentChecklist, requireActiveCollaborator } from "@/lib/collaborators"
import { DocumentsView, type MyDocument } from "./documents-view"

export const metadata: Metadata = { title: "Meus documentos" }

export default async function PortalDocumentsPage() {
  const { session, collaborator } = await requireActiveCollaborator()
  const checklist = await getDocumentChecklist(collaborator.id, session.company.id)
  const company = session.company.tradeName ?? session.company.legalName

  const items: MyDocument[] = checklist.map(({ requirement, document }) => ({
    requirementId: requirement.id,
    name: requirement.name,
    description: requirement.description,
    required: requirement.required,
    document: document
      ? {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          status: document.status,
          reviewNote: document.reviewNote,
          uploadedAt: document.uploadedAt.toISOString(),
          reviewedAt: document.reviewedAt?.toISOString() ?? null,
          reviewedBy: document.reviewedBy,
        }
      : null,
  }))

  const count = (s: string) => items.filter((i) => i.document?.status === s).length
  const missing = items.filter((i) => !i.document).length

  return (
    <>
      <PageHeading subtitle={`Documentos que você enviou para ${company} e a situação de cada um.`} title="Meus documentos" />

      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovados</span>
          <strong>{count("approved")}</strong>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em análise</span>
          <strong>{count("submitted")}</strong>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Recusados</span>
          <strong>{count("rejected")}</strong>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Não enviados</span>
          <strong>{missing}</strong>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="form-hint">A empresa ainda não exige documentos.</p>
      ) : (
        <DocumentsView items={items} />
      )}
    </>
  )
}
