import Link from "next/link"
import { and, asc, eq, isNull, ne } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, contractRequirements, contracts, documentRequirements, memberships, users } from "@/db/schema"
import { Badge, Card } from "@/figma/ui"
import { requireSession } from "@/lib/auth/session"
import { RequirementForm } from "./requirement-form"
import { RequirementItem } from "./requirement-item"

// Aba "Documentos exigidos": o que a empresa pede de TODO colaborador no primeiro acesso, e as listas de
// exigências que cada contrato acrescenta (essas se editam na aba Exigências do próprio contrato).
export async function RequirementsSection() {
  const session = await requireSession("corporate")
  const companyId = session.company.id

  const [items, contractRows] = await Promise.all([
    db
      .select()
      .from(documentRequirements)
      .where(and(eq(documentRequirements.companyId, companyId), isNull(documentRequirements.archivedAt)))
      .orderBy(asc(documentRequirements.createdAt)),
    db
      .select({
        contractId: contracts.id,
        contract: contracts.name,
        person: users.name,
        docName: contractRequirements.name,
        required: contractRequirements.required,
      })
      .from(contractRequirements)
      .innerJoin(contracts, eq(contracts.id, contractRequirements.contractId))
      .leftJoin(collaborators, eq(collaborators.id, contracts.collaboratorId))
      .leftJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .leftJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(contracts.companyId, companyId), ne(contracts.status, "canceled")))
      .orderBy(asc(contracts.name), asc(contractRequirements.createdAt)),
  ])

  const mandatory = items.filter((i) => i.required).length

  // exigências por contrato
  const byContract = new Map<string, { contract: string; person: string | null; docs: { name: string; required: boolean }[] }>()
  for (const r of contractRows) {
    const entry = byContract.get(r.contractId) ?? { contract: r.contract, person: r.person, docs: [] }
    entry.docs.push({ name: r.docName, required: r.required })
    byContract.set(r.contractId, entry)
  }
  const perContract = [...byContract.entries()]

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="dash-kpis">
        <div className="dash-kpi">
          <span className="dash-kpi-label">Documentos exigidos de todos</span>
          <strong>{items.length}</strong>
          <small>pedidos no primeiro acesso</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Obrigatórios</span>
          <strong>{mandatory}</strong>
          <small>sem eles o acesso não é liberado</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Opcionais</span>
          <strong>{items.length - mandatory}</strong>
          <small>o colaborador pode enviar, mas não trava</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Contratos com exigências próprias</span>
          <strong>{perContract.length}</strong>
          <small>além da lista geral</small>
        </div>
      </div>

      <div className="req-layout">
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Exigidos de todo colaborador</strong>
              <span>Todo colaborador novo precisa enviar estes documentos antes de ser liberado.</span>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="cfiles-empty" style={{ minHeight: 180 }}>
              <strong>Nenhum documento exigido ainda</strong>
              <span>Adicione ao lado o primeiro documento, por exemplo o Cartão CNPJ.</span>
            </div>
          ) : (
            <ul className="req-list">
              {items.map((item) => (
                <RequirementItem description={item.description} id={item.id} key={item.id} name={item.name} required={item.required} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Adicionar documento</strong>
              <span>Vale para os colaboradores que entrarem a partir de agora.</span>
            </div>
          </div>
          <RequirementForm />
        </Card>
      </div>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Exigências por contrato</strong>
            <span>Documentos que um contrato específico acrescenta à lista geral. Para mudar, abra o contrato e vá em Exigências.</span>
          </div>
        </div>
        {perContract.length === 0 ? (
          <p className="form-hint">Nenhum contrato tem exigências próprias. Quando houver, elas aparecem aqui.</p>
        ) : (
          <ul className="req-contracts">
            {perContract.map(([id, c]) => (
              <li key={id}>
                <div className="req-contract-head">
                  <div style={{ minWidth: 0 }}>
                    <strong>{c.contract}</strong>
                    {c.person && <span className="form-hint" style={{ display: "block" }}>{c.person}</span>}
                  </div>
                  <Link className="doc-review-next" href={`/app/contratos/${id}?aba=documentos`}>
                    Gerenciar →
                  </Link>
                </div>
                <div className="req-chips">
                  {c.docs.map((d, i) => (
                    <Badge key={`${d.name}-${i}`} tone={d.required ? "warning" : "neutral"}>
                      {d.name}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
