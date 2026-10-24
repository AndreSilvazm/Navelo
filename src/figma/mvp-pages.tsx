"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Icon,
  PageHeading,
  SearchInput,
  SelectField,
  TextField,
  type IconName,
} from "./ui"

const collaborators = [
  {
    initials: "JS",
    name: "João Silva",
    company: "João Tecnologia LTDA",
    cnpj: "12.345.678/0001-90",
    contract: "Contrato Alpha",
    docs: "92%",
    status: "Regular",
    tone: 0,
  },
  {
    initials: "MS",
    name: "Maria Souza",
    company: "Maria Design LTDA",
    cnpj: "28.914.650/0001-12",
    contract: "Contrato Alpha",
    docs: "70%",
    status: "Pendências",
    tone: 1,
  },
  {
    initials: "PL",
    name: "Pedro Lima",
    company: "Lima Consultoria Digital",
    cnpj: "43.208.119/0001-70",
    contract: "Contrato Beta",
    docs: "80%",
    status: "Pendências",
    tone: 2,
  },
]

function MvpMetric({
  icon,
  label,
  tone,
  value,
}: {
  icon: IconName
  label: string
  tone: string
  value: string
}) {
  return (
    <Card className="mvp-metric">
      <span className={`mvp-metric-icon ${tone}`}>
        <Icon name={icon} size={19} />
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  )
}

function MvpAttentionItem({
  action = "Ver pendências",
  copy,
  detail,
  tone,
}: {
  action?: string
  copy: string
  detail: string
  tone: "danger" | "warning"
}) {
  return (
    <div className="mvp-attention-item">
      <span className={`mvp-status-mark ${tone}`} />
      <div>
        <strong>{copy}</strong>
        <span>{detail}</span>
      </div>
      <Button href="/app/pendencias" variant="secondary">
        {action}
      </Button>
    </div>
  )
}

export function MvpBusinessDashboard() {
  return (
    <>
      <PageHeading
        subtitle="Veja o que precisa da sua atenção."
        title="Bom dia, Empresa XPTO"
      />
      <div className="mvp-metric-grid">
        <MvpMetric
          icon="contract"
          label="Contratos ativos"
          tone="primary"
          value="12"
        />
        <MvpMetric icon="people" label="Colaboradores" tone="neutral" value="84" />
        <MvpMetric
          icon="document"
          label="Documentos pendentes"
          tone="amber"
          value="7"
        />
        <MvpMetric
          icon="upload"
          label="Notas fiscais pendentes"
          tone="red"
          value="4"
        />
      </div>
      <Card className="mvp-insight">
        <span>
          <Icon name="grid" size={19} />
        </span>
        <div>
          <strong>
            Atenção: 5 colaboradores ainda não enviaram documentos obrigatórios.
          </strong>
          <p>
            A maior parte das pendências está concentrada no Contrato Alpha.
          </p>
        </div>
        <Button href="/app/pendencias" variant="ghost">
          Resolver agora
        </Button>
      </Card>
      <Card className="mvp-attention-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Atenção necessária</strong>
            <span>Itens que bloqueiam a regularidade dos seus contratos</span>
          </div>
          <Link href="/app/pendencias">Ver todas</Link>
        </div>
        <MvpAttentionItem
          copy="3 documentos aguardando envio"
          detail="João, Pedro e mais 1 colaborador"
          tone="danger"
        />
        <MvpAttentionItem
          copy="4 documentos aguardando análise"
          detail="Enviados nos últimos dois dias"
          tone="warning"
        />
        <MvpAttentionItem
          copy="2 notas fiscais ainda não enviadas"
          detail="Competência Outubro/2026"
          tone="warning"
        />
      </Card>
      <div className="mvp-flow">
        <span>Empresa configura</span>
        <Icon name="arrow" size={16} />
        <span>PJ executa</span>
        <Icon name="arrow" size={16} />
        <span>Navelo acompanha</span>
        <Icon name="arrow" size={16} />
        <span>Empresa resolve</span>
      </div>
    </>
  )
}

export function MvpContractsPage() {
  const items = [
    [
      "Contrato Alpha",
      "Projeto de Tecnologia",
      "84 colaboradores",
      "01/01/2026 — 31/12/2026",
    ],
    [
      "Contrato Beta",
      "Consultoria",
      "12 colaboradores",
      "01/03/2026 — 28/02/2027",
    ],
  ]
  return (
    <>
      <PageHeading
        action={<Button icon="plus">Novo contrato</Button>}
        subtitle="Configure requisitos e acompanhe colaboradores por contrato."
        title="Contratos"
      />
      <div className="mvp-contract-list">
        {items.map(([name, description, people, period]) => (
          <Link key={name} href="/app/contratos/alpha">
            <Card className="mvp-contract-row">
              <span className="entity-icon">
                <Icon name="contract" size={19} />
              </span>
              <div>
                <strong>{name}</strong>
                <span>{description}</span>
              </div>
              <div>
                <span>Período</span>
                <strong>{period}</strong>
              </div>
              <div>
                <span>Colaboradores</span>
                <strong>{people}</strong>
              </div>
              <Badge tone="success">Ativo</Badge>
              <Icon name="chevron" size={17} />
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}

export function MvpContractDetailsPage() {
  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/contratos">Contratos</Link>
        <Icon name="chevron" size={13} />
        <span>Contrato Alpha</span>
      </div>
      <Card className="mvp-contract-hero">
        <span className="contract-main-icon">
          <Icon name="contract" size={23} />
        </span>
        <div>
          <span>Empresa XPTO</span>
          <strong>Contrato Alpha</strong>
          <small>Projeto de Tecnologia</small>
        </div>
        <Badge tone="success">Ativo</Badge>
        <Button variant="secondary">Editar contrato</Button>
      </Card>
      <div className="mvp-contract-facts">
        {[
          ["Período", "01/01/2026 — 31/12/2026"],
          ["Valor", "R$ 714.000"],
          ["Responsável", "Carlos Andrade"],
          ["Colaboradores", "84"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="mvp-contract-areas">
        <Card>
          <span className="mvp-metric-icon primary">
            <Icon name="people" size={20} />
          </span>
          <div>
            <span>Colaboradores</span>
            <strong>84</strong>
            <small>81 regulares · 3 com pendências</small>
          </div>
          <Button href="/app/colaboradores" variant="secondary">
            Ver colaboradores
          </Button>
        </Card>
        <Card>
          <span className="mvp-metric-icon neutral">
            <Icon name="document" size={20} />
          </span>
          <div>
            <span>Documentação</span>
            <strong>92% regular</strong>
            <small>7 documentos precisam de atenção</small>
          </div>
          <Button href="/app/documentos" variant="secondary">
            Ver pendências
          </Button>
        </Card>
        <Card>
          <span className="mvp-metric-icon amber">
            <Icon name="upload" size={20} />
          </span>
          <div>
            <span>Notas fiscais</span>
            <strong>4 pendentes</strong>
            <small>Competência Outubro/2026</small>
          </div>
          <Button href="/app/notas-fiscais" variant="secondary">
            Ver pendências
          </Button>
        </Card>
      </div>
      <div className="mvp-contract-bottom">
        <Card className="mvp-requirements">
          <div className="mvp-section-heading">
            <div>
              <strong>Documentos obrigatórios</strong>
              <span>Requisitos específicos deste contrato</span>
            </div>
            <Button icon="plus" variant="ghost">
              Adicionar documento
            </Button>
          </div>
          {[
            "Cartão CNPJ",
            "Contrato Social",
            "Comprovante bancário",
            "Documento de identificação",
          ].map((item) => (
            <div key={item}>
              <Checkbox />
              <span className="list-file-icon">
                <Icon name="document" size={16} />
              </span>
              <strong>{item}</strong>
              <Badge tone="success">Obrigatório</Badge>
            </div>
          ))}
        </Card>
        <Card className="mvp-next-step">
          <span>
            <Icon name="grid" size={21} />
          </span>
          <strong>Próxima ação recomendada</strong>
          <p>
            Revise os 4 documentos enviados recentemente para manter o contrato
            regular.
          </p>
          <Button href="/app/pendencias">Ver pendências</Button>
        </Card>
      </div>
    </>
  )
}

export function MvpCollaboratorsPage({ tabs, review }: { tabs?: ReactNode; review?: ReactNode }) {
  return (
    <>
      <PageHeading
        subtitle="Acompanhe quem está regular e quem precisa agir."
        title="Colaboradores"
      />
      {tabs}
      {review && <div style={{ marginBottom: 24 }}>{review}</div>}
      <Card className="workspace-table-card">
        <div className="workspace-table-toolbar">
          <SearchInput placeholder="Buscar nome, empresa ou CNPJ..." />
          <SelectField value="Todos os contratos" />
        </div>
        <div className="workspace-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa / CNPJ</th>
                <th>Contrato</th>
                <th>Documentação</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collaborators.map((person) => (
                <tr key={person.name}>
                  <td>
                    <Link
                      className="table-person"
                      href="/app/colaboradores/joao-silva"
                    >
                      <Avatar
                        initials={person.initials}
                        name={person.name}
                        size="sm"
                        tone={person.tone}
                      />
                      <strong>{person.name}</strong>
                    </Link>
                  </td>
                  <td>
                    <div className="mvp-company-cell">
                      <strong>{person.company}</strong>
                      <span>CNPJ {person.cnpj}</span>
                    </div>
                  </td>
                  <td>{person.contract}</td>
                  <td>
                    <div className="documentation-cell">
                      <div>
                        <i style={{ width: person.docs }} />
                      </div>
                      <strong>{person.docs}</strong>
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={person.status === "Regular" ? "success" : "warning"}
                    >
                      {person.status}
                    </Badge>
                  </td>
                  <td>
                    <Icon name="chevron" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function MvpCollaboratorDetailsPage() {
  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/colaboradores">Colaboradores</Link>
        <Icon name="chevron" size={13} />
        <span>João Silva</span>
      </div>
      <Card className="mvp-person-hero">
        <Avatar initials="JS" name="João Silva" size="xl" />
        <div>
          <div>
            <strong>João Silva</strong>
            <Badge tone="success">Regular</Badge>
          </div>
          <span>João Tecnologia LTDA</span>
          <small>CNPJ 12.345.678/0001-90 · Contrato Alpha</small>
        </div>
        <Button variant="secondary">Editar cadastro</Button>
      </Card>
      <div className="mvp-person-grid">
        <Card>
          <span>Documentos</span>
          <strong>92%</strong>
          <small>4 aprovados · 1 próximo do vencimento</small>
          <Button href="/app/documentos" variant="ghost">
            Ver documentos
          </Button>
        </Card>
        <Card>
          <span>Notas fiscais</span>
          <strong>3 enviadas</strong>
          <small>Outubro ainda não foi enviado</small>
          <Button href="/app/notas-fiscais" variant="ghost">
            Ver notas
          </Button>
        </Card>
        <Card>
          <span>Pendências</span>
          <strong>1</strong>
          <small>Documento de identificação</small>
          <Button href="/app/pendencias" variant="ghost">
            Resolver
          </Button>
        </Card>
      </div>
      <Card className="mvp-simple-details">
        <div className="mvp-section-heading">
          <div>
            <strong>Informações principais</strong>
            <span>Dados utilizados neste contrato</span>
          </div>
        </div>
        {[
          ["Contrato", "Contrato Alpha"],
          ["Empresa", "João Tecnologia LTDA"],
          ["CNPJ", "12.345.678/0001-90"],
          ["E-mail", "joao@joaotecnologia.com.br"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </Card>
    </>
  )
}

export function MvpDocumentsPage() {
  const rows = [
    ["João Silva", "Certificado MEI", "Aprovado", "15/10/2027"],
    ["Maria Souza", "Contrato Social", "Em análise", "03/10/2027"],
    ["Pedro Lima", "Documento de identificação", "Pendente", "—"],
  ]
  return (
    <>
      <PageHeading
        subtitle="Veja rapidamente o que foi enviado e o que ainda falta."
        title="Documentos"
      />
      <div className="mvp-filter-tabs">
        {["Todos 96", "Pendentes 7", "Em análise 4", "Aprovados 85"].map(
          (item, index) => (
            <span className={index === 0 ? "active" : ""} key={item}>
              {item}
            </span>
          ),
        )}
      </div>
      <Card className="workspace-table-card">
        <div className="workspace-table-toolbar">
          <SearchInput placeholder="Buscar colaborador ou documento..." />
          <SelectField value="Todos os contratos" />
        </div>
        <div className="workspace-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Documento</th>
                <th>Status</th>
                <th>Validade</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([person, document, status, validity], index) => (
                <tr key={person}>
                  <td>
                    <div className="table-person">
                      <Avatar
                        initials={person
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                        name={person}
                        size="sm"
                        tone={index}
                      />
                      <strong>{person}</strong>
                    </div>
                  </td>
                  <td>
                    <div className="document-name">
                      <Icon name="document" size={16} />
                      <strong>{document}</strong>
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={
                        status === "Aprovado"
                          ? "success"
                          : status === "Em análise"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {status}
                    </Badge>
                  </td>
                  <td>{validity}</td>
                  <td>
                    <Button href="/app/pendencias" variant="ghost">
                      {status === "Em análise"
                        ? "Analisar"
                        : status === "Pendente"
                          ? "Lembrar colaborador"
                          : "Visualizar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function MvpInvoicesPage() {
  const rows = [
    ["João Silva", "Outubro/2026", "R$ 8.500", "Aprovada"],
    ["Maria Souza", "Outubro/2026", "R$ 6.000", "Em análise"],
    ["Pedro Lima", "Outubro/2026", "—", "Não enviada"],
  ]
  return (
    <>
      <PageHeading
        subtitle="Acompanhe recebimento e análise sem complexidade financeira."
        title="Notas fiscais"
      />
      <div className="mvp-metric-grid three">
        <MvpMetric
          icon="check"
          label="Notas recebidas"
          tone="green"
          value="78"
        />
        <MvpMetric icon="clock" label="Notas pendentes" tone="red" value="4" />
        <MvpMetric
          icon="search"
          label="Notas em análise"
          tone="amber"
          value="2"
        />
      </div>
      <Card className="workspace-table-card">
        <div className="workspace-table-toolbar">
          <SearchInput placeholder="Buscar colaborador..." />
          <SelectField value="Outubro/2026" />
        </div>
        <div className="workspace-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Competência</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([person, period, value, status], index) => (
                <tr key={person}>
                  <td>
                    <div className="table-person">
                      <Avatar
                        initials={person
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                        name={person}
                        size="sm"
                        tone={index}
                      />
                      <strong>{person}</strong>
                    </div>
                  </td>
                  <td>{period}</td>
                  <td>
                    <strong>{value}</strong>
                  </td>
                  <td>
                    <Badge
                      tone={
                        status === "Aprovada"
                          ? "success"
                          : status === "Em análise"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {status}
                    </Badge>
                  </td>
                  <td>
                    <Button href="/app/pendencias" variant="ghost">
                      {status === "Em análise"
                        ? "Analisar"
                        : status === "Não enviada"
                          ? "Enviar lembrete"
                          : "Visualizar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function MvpPendingPage() {
  const items = [
    {
      title: "João precisa enviar documento de identificação.",
      person: "João Silva",
      contract: "Contrato Alpha",
      due: "Até 08/10/2026",
      tone: "danger",
    },
    {
      title: "Maria enviou uma nota fiscal que precisa ser analisada.",
      person: "Maria Souza",
      contract: "Contrato Alpha",
      due: "Enviada hoje",
      tone: "warning",
    },
    {
      title: "Pedro ainda não enviou a nota fiscal de outubro.",
      person: "Pedro Lima",
      contract: "Contrato Beta",
      due: "Até 05/10/2026",
      tone: "danger",
    },
    {
      title: "Contrato Social aguardando análise.",
      person: "Maria Souza",
      contract: "Contrato Alpha",
      due: "Enviado ontem",
      tone: "warning",
    },
  ]
  return (
    <>
      <PageHeading
        subtitle="Tudo o que precisa ser resolvido, em um único lugar."
        title="Pendências"
      />
      <Card className="mvp-pending-summary">
        <div>
          <strong>9</strong>
          <span>Pendências abertas</span>
        </div>
        <div>
          <strong>4</strong>
          <span>Precisam da empresa</span>
        </div>
        <div>
          <strong>5</strong>
          <span>Precisam do colaborador</span>
        </div>
      </Card>
      <div className="mvp-pending-list">
        {items.map((item) => (
          <Card key={item.title}>
            <span className={`mvp-status-mark ${item.tone}`} />
            <div>
              <strong>{item.title}</strong>
              <span>
                {item.person} · {item.contract}
              </span>
            </div>
            <div>
              <span>Prazo</span>
              <strong>{item.due}</strong>
            </div>
            <Button variant={item.tone === "danger" ? "primary" : "secondary"}>
              Resolver
            </Button>
          </Card>
        ))}
      </div>
    </>
  )
}

export function MvpPJHomePage() {
  return (
    <>
      <div className="portal-welcome">
        <div>
          <h1 className="page-title">Olá, João</h1>
          <p className="page-subtitle">Veja o que precisa da sua atenção.</p>
        </div>
        <Badge tone="warning">2 pendências</Badge>
      </div>
      <Card className="mvp-pj-action-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Você tem 2 pendências</strong>
            <span>Resolva agora para manter seu contrato em dia</span>
          </div>
        </div>
        <div className="mvp-pj-task danger">
          <span className="pj-task-icon">
            <Icon name="document" size={20} />
          </span>
          <div>
            <strong>Enviar nota fiscal</strong>
            <span>Competência: Outubro/2026</span>
            <small>Prazo: 05/10/2026</small>
          </div>
          <Button href="/portal/notas-fiscais/enviar">Enviar nota fiscal</Button>
        </div>
        <div className="mvp-pj-task warning">
          <span className="pj-task-icon warning">
            <Icon name="upload" size={20} />
          </span>
          <div>
            <strong>Atualizar documento</strong>
            <span>Certificado MEI</span>
            <small>Vence em 15 dias</small>
          </div>
          <Button href="/portal/documentos/enviar" variant="secondary">
            Atualizar documento
          </Button>
        </div>
      </Card>
      <Card className="mvp-pj-insight">
        <span>
          <Icon name="grid" size={19} />
        </span>
        <div>
          <strong>Você precisa agir</strong>
          <p>Sua nota fiscal de outubro ainda não foi enviada.</p>
        </div>
        <Button href="/portal/notas-fiscais/enviar" variant="ghost">
          Resolver agora
        </Button>
      </Card>
      <div className="mvp-pj-quick">
        <Link href="/portal/contrato">
          <Card>
            <span className="mvp-metric-icon primary">
              <Icon name="contract" size={19} />
            </span>
            <div>
              <span>Meu contrato</span>
              <strong>Contrato Alpha</strong>
              <small>Ativo · Empresa XPTO</small>
            </div>
            <Icon name="chevron" size={16} />
          </Card>
        </Link>
        <Link href="/portal/documentos">
          <Card>
            <span className="mvp-metric-icon neutral">
              <Icon name="document" size={19} />
            </span>
            <div>
              <span>Documentos</span>
              <strong>3 aprovados</strong>
              <small>1 próximo do vencimento</small>
            </div>
            <Icon name="chevron" size={16} />
          </Card>
        </Link>
        <Link href="/portal/notas-fiscais">
          <Card>
            <span className="mvp-metric-icon amber">
              <Icon name="upload" size={19} />
            </span>
            <div>
              <span>Notas fiscais</span>
              <strong>1 pendente</strong>
              <small>Outubro/2026</small>
            </div>
            <Icon name="chevron" size={16} />
          </Card>
        </Link>
      </div>
    </>
  )
}

export function MvpPJContractPage() {
  return (
    <>
      <PageHeading
        subtitle="As informações essenciais do seu vínculo."
        title="Meu contrato"
      />
      <Card className="mvp-pj-contract">
        <div className="contract-company-logo">XP</div>
        <div>
          <span>Empresa XPTO</span>
          <strong>Contrato Alpha</strong>
          <small>Sua função: Desenvolvedor</small>
        </div>
        <Badge tone="success">Ativo</Badge>
      </Card>
      <Card className="mvp-pj-contract-details">
        {[
          ["Início", "01/01/2026"],
          ["Término", "31/12/2026"],
          ["Valor", "R$ 8.500/mês"],
          ["Status", "Ativo"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <Button icon="contract" variant="secondary">
          Visualizar contrato
        </Button>
      </Card>
    </>
  )
}

export function MvpPJNotificationsPage() {
  const items = [
    [
      "Seu documento foi aprovado.",
      "Contrato Social · hoje, 09:42",
      "Ver documento",
      "/portal/documentos",
      "success",
    ],
    [
      "Sua nota fiscal foi recebida.",
      "Setembro/2026 · ontem",
      "Ver nota",
      "/portal/notas-fiscais",
      "info",
    ],
    [
      "Você precisa enviar sua nota fiscal até 05/10.",
      "Outubro/2026 · Contrato Alpha",
      "Enviar agora",
      "/portal/notas-fiscais/enviar",
      "warning",
    ],
  ]
  return (
    <>
      <PageHeading
        subtitle="Atualizações importantes e próximas ações."
        title="Notificações"
      />
      <Card className="mvp-notification-list">
        {items.map(([title, detail, action, to, tone]) => (
          <div key={title}>
            <span className={`notification-icon notification-${tone}`}>
              <Icon
                name={
                  tone === "success"
                    ? "check"
                    : tone === "info"
                      ? "document"
                      : "clock"
                }
                size={18}
              />
            </span>
            <div>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
            <Button href={to} variant="ghost">
              {action}
            </Button>
          </div>
        ))}
      </Card>
    </>
  )
}

export function MvpSettingsPage() {
  return (
    <>
      <PageHeading
        subtitle="Mantenha os dados da empresa e defina os avisos de pendências."
        title="Configurações"
      />
      <div className="mvp-settings-grid">
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Empresa</strong>
              <span>Informações exibidas nos contratos e convites.</span>
            </div>
          </div>
          <div className="form-grid">
            <TextField label="Nome da empresa" placeholder="Empresa XPTO" />
            <TextField label="CNPJ" placeholder="84.128.450/0001-22" />
            <TextField
              label="E-mail de contato"
              placeholder="operacoes@empresaxpto.com.br"
            />
            <TextField label="Responsável" placeholder="Carlos Andrade" />
          </div>
          <div className="portal-form-actions">
            <Button>Salvar alterações</Button>
          </div>
        </Card>
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Avisos de pendências</strong>
              <span>Escolha quando o Navelo deve avisar sua equipe.</span>
            </div>
          </div>
          <div className="mvp-settings-options">
            <Checkbox label="Documento obrigatório não enviado" />
            <Checkbox label="Documento aguardando análise" />
            <Checkbox label="Nota fiscal não enviada no prazo" />
          </div>
        </Card>
      </div>
    </>
  )
}
