"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  PageHeading,
  SelectField,
  TextArea,
  TextField,
  UploadZone,
  type IconName,
} from "./ui"

function PortalHeading({
  action,
  subtitle,
  title,
}: {
  action?: ReactNode
  subtitle: string
  title: string
}) {
  return <PageHeading action={action} subtitle={subtitle} title={title} />
}

const invoiceHistory = [
  {
    month: "Setembro 2026",
    value: "R$ 8.500,00",
    date: "03/09/2026",
    status: "Aprovada",
  },
  {
    month: "Agosto 2026",
    value: "R$ 8.500,00",
    date: "04/08/2026",
    status: "Aprovada",
  },
  {
    month: "Julho 2026",
    value: "R$ 8.500,00",
    date: "04/07/2026",
    status: "Aprovada",
  },
  {
    month: "Junho 2026",
    value: "R$ 8.500,00",
    date: "03/06/2026",
    status: "Aprovada",
  },
]

export function PortalInvoicesPage() {
  return (
    <>
      <PortalHeading
        action={
          <Button icon="upload" href="/portal/notas-fiscais/enviar">
            Enviar nota fiscal
          </Button>
        }
        subtitle="Envie e acompanhe suas notas fiscais mensais."
        title="Minhas notas fiscais"
      />
      <div className="pj-invoice-metrics">
        <Card>
          <span>Notas enviadas</span>
          <strong>3</strong>
          <small>Nos últimos 90 dias</small>
        </Card>
        <Card>
          <span>Notas pendentes</span>
          <strong>1</strong>
          <small>Outubro de 2026</small>
        </Card>
        <Card>
          <span>Valor total no mês</span>
          <strong>R$ 8.500</strong>
          <small>Contrato Alpha</small>
        </Card>
      </div>
      <Card className="current-invoice">
        <div className="current-invoice-status">
          <span className="current-invoice-icon">
            <Icon name="document" size={25} />
          </span>
          <div>
            <small>Competência atual</small>
            <strong>Outubro 2026</strong>
            <Badge tone="warning">Aguardando envio</Badge>
          </div>
        </div>
        <div className="invoice-deadline">
          <small>Prazo para envio</small>
          <strong>05/10/2026</strong>
          <span>Faltam 3 dias</span>
        </div>
        <Button href="/portal/notas-fiscais/enviar">
          Enviar nota fiscal <Icon name="arrow" size={16} />
        </Button>
      </Card>
      <div className="portal-section-heading">
        <div>
          <strong>Histórico</strong>
          <span>Suas notas fiscais anteriores</span>
        </div>
        <SelectField value="2026" />
      </div>
      <Card className="portal-list-card">
        <div className="portal-list-head invoice-row">
          <span>Competência</span>
          <span>Valor</span>
          <span>Enviada em</span>
          <span>Status</span>
          <span />
        </div>
        {invoiceHistory.map((invoice) => (
          <div className="portal-list-row invoice-row" key={invoice.month}>
            <div className="list-primary">
              <span className="list-file-icon">
                <Icon name="document" size={18} />
              </span>
              <div>
                <strong>{invoice.month}</strong>
                <small>NF-{invoice.date.replaceAll("/", "")}.pdf</small>
              </div>
            </div>
            <strong>{invoice.value}</strong>
            <span>{invoice.date}</span>
            <Badge tone="success">{invoice.status}</Badge>
            <Link
              aria-label={`Ver nota de ${invoice.month}`}
              href="/portal/notas-fiscais"
            >
              <Icon name="chevron" size={18} />
            </Link>
          </div>
        ))}
      </Card>
    </>
  )
}

function SuccessState({
  copy,
  status,
  title,
  href,
}: {
  copy: string
  status?: string
  title: string
  href: string
}) {
  return (
    <Card className="portal-success">
      <span>
        <Icon name="check" size={28} />
      </span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {status && <Badge tone="warning">{status}</Badge>}
      <Button href={href}>Continuar</Button>
    </Card>
  )
}

export function PortalInvoiceUploadPage() {
  const [file, setFile] = useState<{ name: string; size: string }>()
  const [sent, setSent] = useState(false)
  if (sent)
    return (
      <SuccessState
        copy="Recebemos o arquivo e avisaremos quando a empresa concluir a análise."
        status="Em análise"
        title="Nota fiscal enviada com sucesso"
        href="/portal/notas-fiscais"
      />
    )
  return (
    <>
      <div className="breadcrumb">
        <Link href="/portal/notas-fiscais">Notas fiscais</Link>
        <Icon name="chevron" size={13} />
        <span>Enviar nota fiscal</span>
      </div>
      <PortalHeading
        subtitle="Envie o arquivo e confira os dados antes de concluir."
        title="Enviar nota fiscal"
      />
      <div className="portal-form-layout">
        <Card className="portal-form-card">
          <div className="form-summary">
            <div>
              <span>Competência</span>
              <strong>Outubro 2026</strong>
            </div>
            <div>
              <span>Valor esperado</span>
              <strong>R$ 8.500,00</strong>
            </div>
          </div>
          <div className="portal-form-section">
            <div className="portal-form-title">
              <span>1</span>
              <div>
                <strong>Arquivo da nota fiscal</strong>
                <small>Envie o PDF ou XML emitido pela sua prefeitura.</small>
              </div>
            </div>
            <UploadZone
              accept=".pdf,.xml"
              formats="PDF ou XML • Máx. 10 MB"
              onFileChange={(f) => setFile(f ? { name: f.name, size: "" } : undefined)}
              title="Arraste sua nota fiscal aqui"
            />
            {file && (
              <div className="pj-extracted-data">
                <div className="pj-extracted-title">
                  <span>
                    <Icon name="check" size={15} />
                  </span>
                  <div>
                    <strong>Dados identificados</strong>
                    <small>Confira e edite se necessário.</small>
                  </div>
                </div>
                {[
                  ["Número", "00125"],
                  ["Valor", "R$ 8.500,00"],
                  ["Data", "03/10/2026"],
                  ["Competência", "Outubro/2026"],
                  ["CNPJ", "12.345.678/0001-90"],
                  ["Tomador", "Empresa XPTO"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="portal-form-section">
            <div className="portal-form-title">
              <span>2</span>
              <div>
                <strong>Dados da nota</strong>
                <small>Confira as informações para evitar rejeições.</small>
              </div>
            </div>
            <div className="form-grid">
              <TextField label="Número da nota" placeholder="Ex.: 000042" />
              <TextField label="Data de emissão" placeholder="DD/MM/AAAA" />
              <TextField label="Valor" placeholder="R$ 8.500,00" />
              <div />
            </div>
            <TextArea
              label="Observações"
              placeholder="Adicione uma observação, se necessário."
            />
          </div>
          <div className="portal-form-actions">
            <Button href="/portal/notas-fiscais" variant="secondary">
              Cancelar
            </Button>
            <Button disabled={!file} onClick={() => setSent(true)}>
              Enviar nota fiscal
            </Button>
          </div>
        </Card>
        <Card className="portal-tip-card">
          <span>
            <Icon name="shield" size={20} />
          </span>
          <div>
            <strong>Antes de enviar</strong>
            <p>
              Confira se o CNPJ da empresa e o valor da nota estão corretos.
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}

const documentItems = [
  {
    name: "Documento de identificação",
    detail: "RG ou CNH",
    status: "Pendente",
    tone: "danger" as const,
    date: "Envio obrigatório",
  },
  {
    name: "Comprovante de endereço",
    detail: "Emitido nos últimos 90 dias",
    status: "Aprovado",
    tone: "success" as const,
    date: "Atualizado em 12/08/2026",
  },
  {
    name: "Contrato social",
    detail: "Última alteração consolidada",
    status: "Em análise",
    tone: "warning" as const,
    date: "Enviado em 01/10/2026",
  },
  {
    name: "Certificado MEI",
    detail: "CCMEI atualizado",
    status: "Próximo do vencimento",
    tone: "info" as const,
    date: "Vence em 28/10/2026",
  },
  {
    name: "Dados bancários",
    detail: "Comprovante da conta PJ",
    status: "Aprovado",
    tone: "success" as const,
    date: "Atualizado em 10/01/2026",
  },
]

export function PortalDocumentsPage() {
  return (
    <>
      <PortalHeading
        action={
          <Button icon="upload" href="/portal/documentos/enviar">
            Enviar documento
          </Button>
        }
        subtitle="Mantenha seus documentos sempre atualizados."
        title="Meus documentos"
      />
      <Card className="pj-document-progress">
        <div>
          <span>Documentação</span>
          <strong>85% completa</strong>
        </div>
        <div>
          <i />
        </div>
        <small>4 de 5 documentos estão regulares</small>
      </Card>
      <div className="document-alert">
        <span>
          <Icon name="clock" size={19} />
        </span>
        <div>
          <strong>Seu documento está próximo do vencimento</strong>
          <small>
            Certificado MEI · vence em 15/10/2026. Envie uma versão atualizada
            para evitar pendências.
          </small>
        </div>
        <Button href="/portal/documentos/enviar" variant="secondary">
          Atualizar documento
        </Button>
      </div>
      <div className="portal-document-grid">
        {documentItems.map((document) => (
          <Card className="portal-document-card" key={document.name}>
            <div className="document-card-top">
              <span className="document-large-icon">
                <Icon name="document" size={23} />
              </span>
              <Badge tone={document.tone}>{document.status}</Badge>
            </div>
            <strong>{document.name}</strong>
            <span>{document.detail}</span>
            <small>{document.date}</small>
            <Button
              href="/portal/documentos/enviar"
              variant={document.status === "Pendente" ? "primary" : "secondary"}
            >
              {document.status === "Pendente"
                ? "Enviar documento"
                : "Ver documento"}
            </Button>
          </Card>
        ))}
        <Card className="portal-document-card document-other">
          <span className="document-large-icon">
            <Icon name="plus" size={23} />
          </span>
          <strong>Outro documento</strong>
          <span>Envie um documento adicional para a empresa.</span>
          <Button href="/portal/documentos/enviar" variant="secondary">
            Adicionar
          </Button>
        </Card>
      </div>
    </>
  )
}

export function PortalDocumentUploadPage() {
  const [file, setFile] = useState<{ name: string; size: string }>()
  const [sent, setSent] = useState(false)
  if (sent)
    return (
      <SuccessState
        copy="O documento foi recebido e será analisado pela empresa."
        title="Documento enviado com sucesso"
        status="Em análise"
        href="/portal/documentos"
      />
    )
  return (
    <>
      <div className="breadcrumb">
        <Link href="/portal/documentos">Meus documentos</Link>
        <Icon name="chevron" size={13} />
        <span>Enviar documento</span>
      </div>
      <PortalHeading
        subtitle="Selecione o tipo e envie um arquivo legível."
        title="Enviar documento"
      />
      <Card className="portal-form-card portal-narrow-form">
        <SelectField label="Tipo de documento" value="Certificado MEI" />
        <UploadZone
          accept=".pdf,.jpg,.jpeg,.png"
          formats="PDF, JPG ou PNG • Máx. 10 MB"
          onFileChange={(f) => setFile(f ? { name: f.name, size: "" } : undefined)}
          title="Arraste seu arquivo aqui"
        />
        {file && <TextField label="Validade" placeholder="15/10/2027" />}
        <div className="portal-form-actions">
          <Button href="/portal/documentos" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={!file} onClick={() => setSent(true)}>
            Enviar documento
          </Button>
        </div>
      </Card>
    </>
  )
}

export function PortalProfilePage() {
  return (
    <>
      <PortalHeading
        action={<Button variant="secondary">Editar informações</Button>}
        subtitle="Consulte e mantenha seus dados atualizados."
        title="Meu perfil"
      />
      <Card className="portal-profile-header">
        <Avatar initials="JS" name="João Silva" size="xl" tone={0} />
        <div>
          <strong>João Silva</strong>
          <span>João Tecnologia LTDA · Profissional PJ</span>
          <Badge tone="success">Cadastro completo</Badge>
        </div>
      </Card>
      <div className="profile-sections">
        <InfoSection
          icon="people"
          items={[
            ["Nome", "João Silva"],
            ["CPF", "184.792.630-04"],
            ["E-mail", "joao@joaotecnologia.com.br"],
            ["Telefone", "(11) 98945-2201"],
          ]}
          title="Dados pessoais"
        />
        <InfoSection
          icon="briefcase"
          items={[
            ["CNPJ", "12.345.678/0001-90"],
            ["Razão social", "João Tecnologia LTDA"],
            ["Nome fantasia", "João Tecnologia"],
            ["Situação cadastral", "Ativa"],
            ["Endereço", "São Paulo, SP"],
          ]}
          title="Dados da empresa"
        />
        <InfoSection
          icon="payment"
          items={[
            ["Banco", "Banco Inter"],
            ["Agência", "0001"],
            ["Conta", "1234567-8"],
            ["Chave Pix", "42.581.963/0001-20"],
          ]}
          title="Dados bancários"
        />
        <InfoSection
          icon="shield"
          items={[
            ["Senha", "Atualizada há 32 dias"],
            ["Verificação em duas etapas", "Ativada"],
          ]}
          title="Segurança"
        />
      </div>
    </>
  )
}

function InfoSection({
  icon,
  items,
  title,
}: {
  icon: IconName
  items: string[][]
  title: string
}) {
  return (
    <Card className="profile-info-section">
      <div className="profile-section-title">
        <span>
          <Icon name={icon} size={19} />
        </span>
        <strong>{title}</strong>
      </div>
      <div className="profile-info-grid">
        {items.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Card>
  )
}
