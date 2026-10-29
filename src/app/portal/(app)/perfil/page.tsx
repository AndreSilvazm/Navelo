import type { Metadata } from "next"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { bankChangeRequests } from "@/db/schema"
import { Avatar, Badge, Card, PageHeading } from "@/figma/ui"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { formatCnpj, onlyDigits } from "@/lib/cnpj"
import { initialsOf } from "@/lib/initials"
import { BankForm } from "./bank-form"

export const metadata: Metadata = { title: "Meu perfil" }

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={`info-field ${wide ? "info-wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

const data = (d: Date) => d.toLocaleDateString("pt-BR")

export default async function PortalProfilePage() {
  const { session, collaborator: c } = await requireActiveCollaborator()

  // pedido de troca bancária: em análise, ou o último recusado (para a pessoa corrigir)
  const [pedido] = await db
    .select()
    .from(bankChangeRequests)
    .where(and(eq(bankChangeRequests.collaboratorId, c.id), inArray(bankChangeRequests.status, ["pending", "rejected"])))
    .orderBy(desc(bankChangeRequests.createdAt))
    .limit(1)
  const emAnalise = pedido?.status === "pending" ? pedido : null
  const recusado = pedido?.status === "rejected" ? pedido : null
  const company = session.company.tradeName ?? session.company.legalName

  const phone = c.phone ? onlyDigits(c.phone).replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : null
  const address = [
    [c.street, c.number].filter(Boolean).join(", "),
    c.complement,
    c.district,
    [c.city, c.state].filter(Boolean).join("/"),
    c.zipCode ? c.zipCode.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <PageHeading subtitle="Seus dados no Navelo. Os dados bancários você mesmo atualiza." title="Meu perfil" />

      <div className="profile-stack">
        <Card className="mvp-settings-card">
          <div className="profile-head">
            <Avatar initials={initialsOf(session.user.name)} name={session.user.name} size="lg" tone={session.user.name.length} />
            <div>
              <strong>{session.user.name}</strong>
              <span>{[c.jobTitle, company].filter(Boolean).join(" · ")}</span>
            </div>
            <Badge tone="success">Ativo</Badge>
          </div>
          <dl className="info-grid" style={{ marginTop: 20 }}>
            <Field label="E-mail de acesso" value={session.user.email} />
            <Field label="Cargo" value={c.jobTitle} />
            <Field label="Contratante" value={company} />
            <Field label="Ativo desde" value={c.approvedAt ? c.approvedAt.toLocaleDateString("pt-BR") : null} />
          </dl>
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Dados da empresa</strong>
              <span>Vêm da Receita Federal e não podem ser alterados aqui. Se algo estiver desatualizado, regularize na Receita ou fale com a empresa contratante.</span>
            </div>
          </div>
          <dl className="info-grid">
            <Field label="Razão social" value={c.legalName} />
            <Field label="Nome fantasia" value={c.tradeName} />
            <Field label="CNPJ" value={c.cnpj ? formatCnpj(c.cnpj) : null} />
            <Field label="Telefone" value={phone} />
            <Field label="Endereço" value={address} wide />
          </dl>
        </Card>

        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Dados bancários</strong>
              <span>Para os pagamentos. A conta precisa ser da sua empresa (mesmo CNPJ). Trocar a conta passa por análise da empresa.</span>
            </div>
          </div>
          <BankForm
            pending={
              emAnalise
                ? {
                    createdAt: data(emAnalise.createdAt),
                    values: {
                      bankCode: emAnalise.bankCode,
                      bankName: emAnalise.bankName,
                      bankAgency: emAnalise.bankAgency,
                      bankAccount: emAnalise.bankAccount,
                      bankAccountType: emAnalise.bankAccountType,
                      pixKey: emAnalise.pixKey ?? "",
                    },
                  }
                : null
            }
            rejected={recusado?.reviewedAt ? { note: recusado.reviewNote, at: data(recusado.reviewedAt) } : null}
            initial={{
              bankCode: c.bankCode ?? "",
              bankName: c.bankName ?? "",
              bankAgency: c.bankAgency ?? "",
              bankAccount: c.bankAccount ?? "",
              bankAccountType: c.bankAccountType ?? "",
              pixKey: c.pixKey ?? "",
            }}
          />
        </Card>
      </div>
    </>
  )
}
