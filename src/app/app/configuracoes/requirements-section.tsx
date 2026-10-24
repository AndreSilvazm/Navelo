import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { documentRequirements } from "@/db/schema"
import { Badge, Button, Card } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { archiveRequirement } from "./requirements-actions"
import { RequirementForm } from "./requirement-form"

// Documentos que a empresa exige de todos os colaboradores no primeiro acesso
export async function RequirementsSection() {
  const session = await requireSession("corporate")

  const items = await db
    .select()
    .from(documentRequirements)
    .where(and(eq(documentRequirements.companyId, session.company.id), isNull(documentRequirements.archivedAt)))
    .orderBy(asc(documentRequirements.createdAt))

  return (
    <div className="mvp-settings-grid" style={{ marginTop: 24 }}>
      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Documentos exigidos</strong>
            <span>Todo colaborador novo precisa enviar estes documentos antes de ser liberado.</span>
          </div>
        </div>
        <RequirementForm />
      </Card>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Lista atual</strong>
            <span>{items.length} documento(s) exigido(s)</span>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {items.length === 0 && <p className="form-hint">Nenhum documento exigido ainda.</p>}
          {items.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <strong>{item.name}</strong>
                {item.description && <div className="form-hint">{item.description}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={item.required ? "warning" : "neutral"}>{item.required ? "Obrigatório" : "Opcional"}</Badge>
                <form action={archiveRequirement.bind(null, item.id)}>
                  <Button type="submit" variant="ghost">
                    Remover
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
