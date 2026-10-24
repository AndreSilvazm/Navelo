import type { Metadata } from "next"
import { Badge, Button, Card, PageHeading } from "@/figma/ui"
import { ContractSummary } from "@/components/contract-summary"
import { getCollaboratorContracts } from "@/lib/collaborator-contracts"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { contractStatusOf } from "@/app/app/contratos/status"

export const metadata: Metadata = { title: "Meu contrato" }

export default async function PortalContractPage() {
  const { collaborator, session } = await requireActiveCollaborator()
  const list = await getCollaboratorContracts(collaborator.id)
  const company = session.company.tradeName ?? session.company.legalName

  return (
    <>
      <PageHeading
        action={
          list.length > 0 ? (
            <Button href="/portal/notas-fiscais/enviar" icon="plus">
              Enviar nota fiscal
            </Button>
          ) : undefined
        }
        subtitle={`Contrato${list.length > 1 ? "s" : ""} com ${company}: período, prazo de envio das notas e documentos exigidos.`}
        title={list.length > 1 ? "Meus contratos" : "Meu contrato"}
      />

      {list.length === 0 ? (
        <Card className="mvp-settings-card">
          <p className="form-hint">Você ainda não foi vinculado a nenhum contrato. Quando a empresa fizer isso, ele aparece aqui.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {list.map((c) => {
            const status = contractStatusOf(c)
            return (
              <Card className="mvp-settings-card" key={c.id}>
                <div className="mvp-section-heading">
                  <div>
                    <strong>{c.name}</strong>
                    <span>{company}</span>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <ContractSummary contract={c} />
                {c.requirements.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <strong>Documentos exigidos neste contrato</strong>
                    <ul className="plain-list" style={{ marginTop: 10 }}>
                      {c.requirements.map((r) => (
                        <li key={r.name}>
                          {r.name} <span className="form-hint">{r.required ? "· obrigatório" : "· opcional"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
