import type { Metadata } from "next"
import { Badge, Button, Card } from "@/figma/ui"
import { getBankAccounts, toFormValues } from "@/lib/bank-accounts"
import { COMPANY_FIELDS, fetchCompanyProfile } from "@/lib/cnpj-lookup"
import { getDocumentChecklist, requireOnboardingCollaborator } from "@/lib/collaborators"
import { getPortalCompanies } from "@/lib/portal-companies"
import { BankStepForm } from "./bank-step-form"
import { DocumentsForm } from "./documents-form"
import { ProfileForm } from "./profile-form"

export const metadata: Metadata = { title: "Primeiro acesso" }

const steps = ["Dados da empresa", "Dados bancários", "Documentos", "Análise"]

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ etapa?: string }> }) {
  const { session, collaborator } = await requireOnboardingCollaborator()
  const { etapa } = await searchParams
  const companyName = session.company.tradeName ?? session.company.legalName
  // já é colaborador ativo em outra empresa: não é o primeiro acesso à plataforma
  const { companies } = await getPortalCompanies(session)
  const joiningAnother = companies.some((c) => !c.current && c.status === "active")

  // etapa atual pelo status; em "documentos" ainda dá para voltar e corrigir os dados
  const editingProfile = collaborator.status === "profile_pending" || (collaborator.status === "documents_pending" && etapa === "dados")
  const suspended = collaborator.status === "suspended"
  // recusado ou suspenso: o colaborador só vê o aviso, sem etapas nem formulários
  const rejected = collaborator.status === "rejected" || suspended
  // dados bancários: aparecem logo depois da empresa, e de novo se a conta PJ ainda não foi informada
  const bank = !rejected && collaborator.status !== "profile_pending" ? await getBankAccounts(session.user.id) : { pj: null, pf: null }
  const editingBank = !editingProfile && collaborator.status === "documents_pending" && (!bank.pj || etapa === "banco")
  const current = collaborator.status === "in_review" ? 3 : editingProfile ? 0 : editingBank ? 1 : 2

  const checklist =
    !rejected && current === 2 ? await getDocumentChecklist(collaborator.id, session.company.id) : []

  // ao reabrir um cadastro já salvo: CNPJ e tudo que a Receita informa ficam travados
  let lockedFields: string[] = []
  if (editingProfile && collaborator.cnpj) {
    const receita = await fetchCompanyProfile(collaborator.cnpj)
    lockedFields = ["cnpj", ...(receita.status === "ok" ? COMPANY_FIELDS.filter((f) => receita.data[f]) : [])]
  }

  const saved = {
    legalName: collaborator.legalName ?? "",
    tradeName: collaborator.tradeName ?? "",
    cnpj: collaborator.cnpj ?? "",
    phone: collaborator.phone ?? "",
    zipCode: collaborator.zipCode ?? "",
    street: collaborator.street ?? "",
    number: collaborator.number ?? "",
    complement: collaborator.complement ?? "",
    district: collaborator.district ?? "",
    city: collaborator.city ?? "",
    state: collaborator.state ?? "",
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">{joiningAnother ? `Cadastro em ${companyName}` : "Bem-vindo ao Navelo"}</h1>
          {!rejected && (
            <p className="page-subtitle">
              {joiningAnother ? (
                <>
                  Seus dados e sua conta bancária já estão salvos. Falta só o que <strong>{companyName}</strong> pede. Você pode sair
                  desta tela quando quiser (pelo menu da empresa, no topo) e continuar depois.
                </>
              ) : (
                <>
                  Para começar a trabalhar com <strong>{companyName}</strong>, complete seu cadastro. Você vai precisar de poucos
                  minutos.
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {suspended && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Acesso suspenso</strong>
              <span>
                {companyName} suspendeu o seu acesso à plataforma
                {collaborator.suspendedAt && ` em ${collaborator.suspendedAt.toLocaleDateString("pt-BR")}`}. Seus dados foram mantidos.
                Para voltar a acessar, fale diretamente com a empresa.
              </span>
            </div>
            <Badge tone="warning">Acesso suspenso</Badge>
          </div>
          {collaborator.suspensionReason && <p className="form-alert">Motivo informado: {collaborator.suspensionReason}</p>}
        </Card>
      )}

      {rejected && !suspended && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Acesso não liberado</strong>
              <span>
                {companyName} recusou o seu acesso à plataforma
                {collaborator.rejectedAt && ` em ${collaborator.rejectedAt.toLocaleDateString("pt-BR")}`}. Se acredita que foi
                um engano, fale diretamente com a empresa.
              </span>
            </div>
            <Badge tone="danger">Acesso recusado</Badge>
          </div>
          {collaborator.rejectionReason && <p className="form-alert">Motivo informado: {collaborator.rejectionReason}</p>}
        </Card>
      )}

      {!rejected && (
      <ol aria-label="Etapas do cadastro" className="onboarding-steps">
        {steps.map((label, i) => (
          <li
            aria-current={i === current ? "step" : undefined}
            className={i < current ? "done" : i === current ? "current" : ""}
            key={label}
          >
            <span>{i < current ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      )}

      {!rejected && current === 0 && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Dados da sua empresa</strong>
              <span>Informe os dados do seu CNPJ, como constam na Receita Federal. Os dados bancários vêm na próxima etapa.</span>
            </div>
          </div>
          <ProfileForm
            initialLocked={lockedFields}
            saved={saved}
            submitLabel={collaborator.status === "profile_pending" ? "Salvar e continuar" : "Salvar dados"}
          />
        </Card>
      )}

      {!rejected && current === 1 && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Dados bancários</strong>
              <span>Para os pagamentos. A conta PJ, da sua empresa, é obrigatória. A conta pessoa física é opcional.</span>
            </div>
          </div>
          <BankStepForm pf={bank.pf ? toFormValues(bank.pf) : null} pj={toFormValues(bank.pj)} submitLabel="Salvar e continuar" />
        </Card>
      )}

      {!rejected && current === 2 && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Documentos</strong>
              <span>
                {companyName} exige os documentos abaixo. Anexe todos e envie de uma vez — o botão libera
                quando os obrigatórios estiverem anexados.
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button href="/portal/primeiro-acesso?etapa=dados" variant="ghost">
                Editar dados da empresa
              </Button>
              <Button href="/portal/primeiro-acesso?etapa=banco" variant="ghost">
                Editar dados bancários
              </Button>
            </div>
          </div>
          <DocumentsForm items={checklist} />
        </Card>
      )}

      {!rejected && current === 3 && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Em análise</strong>
              <span>
                Recebemos seus dados e documentos. {companyName} vai analisar e liberar seu acesso. Assim
                que isso acontecer, você poderá entrar normalmente na plataforma.
              </span>
            </div>
            <Badge tone="info">Em análise</Badge>
          </div>
        </Card>
      )}
    </>
  )
}
