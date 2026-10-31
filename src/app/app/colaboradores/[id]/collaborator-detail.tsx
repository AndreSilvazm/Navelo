"use client"

import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { BankLogo } from "@/components/bank-logo"
import { Avatar, Badge, Button, Card, Icon } from "@/figma/ui"
import { ReasonDialog } from "@/components/reason-dialog"
import { formatCnpj, onlyDigits } from "@/lib/cnpj"
import { documentFileQuery } from "@/lib/document-file"
import { initialsOf } from "@/lib/initials"
import { approveBankChange, approveCollaborator, reactivateCollaborator, rejectBankChange, rejectCollaborator, reopenCollaborator, suspendCollaborator } from "../actions"
import { statusLabel, statusTone } from "../types"
import { CnpjPanel } from "./cnpj-panel"
import { CollaboratorDashboard } from "./collaborator-dashboard"
import { DocumentReview, documentUrl } from "./document-review"
import { InvoicesTab } from "./invoices-tab"
import { ProgressTimeline } from "./progress-timeline"
import { ReimbursementsTab } from "./reimbursements-tab"
import { detailQueryKey, isReadyForApproval, type CollaboratorDetailData } from "./types"

export type DetailTab = "andamento" | "dashboard" | "geral" | "documentos" | "bancarios" | "notas" | "reembolsos"

const TABS: { id: DetailTab; label: string }[] = [
  { id: "andamento", label: "Andamento do cadastro" },
  { id: "dashboard", label: "Dashboard" },
  { id: "geral", label: "Informações gerais" },
  { id: "documentos", label: "Documentos" },
  { id: "bancarios", label: "Dados bancários" },
  { id: "notas", label: "Notas fiscais" },
  { id: "reembolsos", label: "Reembolsos" },
]

const fetchDetail = async (id: string): Promise<CollaboratorDetailData> => {
  const res = await fetch(`/api/colaboradores/${id}`)
  if (!res.ok) throw new Error("Falha ao carregar o colaborador")
  return res.json()
}

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="info-field">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

// Página do colaborador toda no cliente: as abas trocam sem ir ao servidor, os dados ficam
// no cache (TanStack Query) e as decisões (aprovar/recusar) só atualizam esse cache.
export function CollaboratorDetail({ data: initial, tab: initialTab }: { data: CollaboratorDetailData; tab: DetailTab }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<DetailTab>(initialTab)
  // painel de motivo: recusar o acesso (antes da liberação) ou suspendê-lo (depois)
  const [panel, setPanel] = useState<"reject" | "suspend" | null>(null)
  // recusa do pedido de troca de conta (pede o motivo no mesmo tipo de modal)
  const [rejectingBank, setRejectingBank] = useState(false)

  const { data = initial } = useQuery({
    queryKey: detailQueryKey(initial.id),
    queryFn: () => fetchDetail(initial.id),
    initialData: initial,
    staleTime: 10_000,
  })

  // notas fiscais só existem para quem já está ativo
  const invoicesEnabled = data.status === "active"
  const activeTab: DetailTab = (tab === "notas" || tab === "reembolsos") && !invoicesEnabled ? "andamento" : tab

  // mantém a URL compartilhável sem recarregar
  useEffect(() => {
    window.history.replaceState(null, "", activeTab === "andamento" ? `/app/colaboradores/${data.id}` : `/app/colaboradores/${data.id}?aba=${activeTab}`)
  }, [activeTab, data.id])

  // baixa os documentos em segundo plano: quando abrir a aba, já estão na memória
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const item of data.checklist) {
        if (cancelled || !item.document) continue
        await queryClient.prefetchQuery(documentFileQuery(documentUrl(item.document))).catch(() => {})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data.checklist, queryClient])

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: detailQueryKey(data.id) }),
      queryClient.invalidateQueries({ queryKey: ["collaborators"] }), // lista também fica desatualizada
    ])

  const approve = useMutation({ mutationFn: () => approveCollaborator(data.id), onSuccess: refresh })
  const decide = useMutation({
    mutationFn: ({ kind, text }: { kind: "reject" | "suspend"; text: string }) => {
      const form = new FormData()
      form.set("reason", text)
      return kind === "reject" ? rejectCollaborator(data.id, form) : suspendCollaborator(data.id, form)
    },
    onSuccess: () => {
      setPanel(null)
      return refresh()
    },
  })
  const reopen = useMutation({ mutationFn: () => reopenCollaborator(data.id), onSuccess: refresh })
  const approveBank = useMutation({ mutationFn: (id: string) => approveBankChange(id), onSuccess: refresh })
  const rejectBank = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      const form = new FormData()
      form.set("reason", reason)
      return rejectBankChange(id, form)
    },
    onSuccess: () => {
      setRejectingBank(false)
      refresh()
    },
  })
  const reactivate = useMutation({ mutationFn: () => reactivateCollaborator(data.id), onSuccess: refresh })

  const title = data.legalName ?? data.name
  // ninguém decide sobre o próprio cadastro: as ações somem e o motivo aparece
  const canDecide = !data.isSelf
  const canApprove = canDecide && data.status === "in_review" && isReadyForApproval(data.checklist)
  const canReject = canDecide && (data.status === "profile_pending" || data.status === "documents_pending" || data.status === "in_review")
  const inReview = data.invoices.filter((i) => i.status === "submitted").length // notas esperando decisão
  const reimbursementsInReview = data.reimbursements.filter((r) => r.status === "submitted").length // reembolsos esperando decisão
  const canSuspend = canDecide && data.status === "active"
  const busy = approve.isPending || decide.isPending || reopen.isPending || reactivate.isPending
  const address = [
    [data.street, data.number].filter(Boolean).join(", "),
    data.complement,
    data.district,
    [data.city, data.state].filter(Boolean).join("/"),
    data.zipCode ? data.zipCode.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/colaboradores">Colaboradores</Link>
        <Icon name="chevron" size={13} />
        <span>{title}</span>
      </div>

      <div className="collab-header">
        <Avatar initials={initialsOf(title)} name={title} size="md" tone={data.name.length} />
        <div className="collab-header-info">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {data.name}
            {data.jobTitle && ` · ${data.jobTitle}`}
          </p>
        </div>
        <div className="collab-header-actions">
          <Badge tone={statusTone[data.status]}>{statusLabel[data.status]}</Badge>
          {canReject && !panel && (
            <Button disabled={busy} onClick={() => setPanel("reject")} variant="secondary">
              Recusar acesso
            </Button>
          )}
          {canSuspend && !panel && (
            <Button disabled={busy} onClick={() => setPanel("suspend")} variant="secondary">
              Suspender acesso
            </Button>
          )}
          {canDecide && data.status === "suspended" && (
            <Button disabled={busy} loading={reactivate.isPending} onClick={() => reactivate.mutate()}>
              Reativar acesso
            </Button>
          )}
          {canDecide && data.status === "in_review" && (
            <Button disabled={!canApprove || busy} icon="check" loading={approve.isPending} onClick={() => approve.mutate()}>
              Liberar acesso
            </Button>
          )}
          {canDecide && data.status === "rejected" && (
            <Button disabled={busy} loading={reopen.isPending} onClick={() => reopen.mutate()} variant="secondary">
              Reabrir cadastro
            </Button>
          )}
        </div>
      </div>
      {data.isSelf && (
        <p className="form-alert" style={{ marginTop: 4, marginBottom: 16 }}>
          Este é o seu próprio cadastro de colaborador. Quem analisa e decide tem que ser outra pessoa do corporativo.
        </p>
      )}
      {canDecide && data.status === "in_review" && !canApprove && (
        <p className="form-hint" style={{ marginTop: -8, marginBottom: 16, textAlign: "right" }}>
          Aprove todos os documentos obrigatórios para liberar o acesso.
        </p>
      )}

      <ReasonDialog
        confirmLabel={panel === "reject" ? "Confirmar recusa" : "Confirmar suspensão"}
        description={
          panel === "reject"
            ? "O colaborador não poderá usar a plataforma e verá o motivo. Você pode reabrir o cadastro depois. A data e quem recusou ficam registrados."
            : "O colaborador deixa de acessar o portal e verá o motivo. Dados e contratos são mantidos e você pode reativar quando quiser. A data e quem suspendeu ficam registrados."
        }
        error={decide.isError}
        label={panel === "reject" ? "Motivo da recusa" : "Motivo da suspensão"}
        onClose={() => setPanel(null)}
        onConfirm={(reason) => panel && decide.mutate({ kind: panel, text: reason })}
        open={panel !== null}
        pending={decide.isPending}
        title={panel === "suspend" ? `Suspender o acesso de ${data.name}?` : `Recusar o acesso de ${data.name}?`}
      />

      <CnpjPanel cnpj={data.cnpj} collaboratorId={data.id} />

      <nav aria-label="Seções do colaborador" className="page-tabs">
        {TABS.map((t) => {
          const disabled = (t.id === "notas" || t.id === "reembolsos") && !invoicesEnabled
          return (
            <button
              aria-current={activeTab === t.id ? "page" : undefined}
              disabled={disabled}
              key={t.id}
              onClick={() => setTab(t.id)}
              title={disabled ? "Disponível quando o colaborador estiver ativo" : undefined}
              type="button"
            >
              {t.label}
              {t.id === "notas" && inReview > 0 && <span className="page-tab-count">{inReview}</span>}
              {t.id === "reembolsos" && reimbursementsInReview > 0 && <span className="page-tab-count">{reimbursementsInReview}</span>}
            </button>
          )
        })}
      </nav>

      {activeTab === "dashboard" && <CollaboratorDashboard data={data} />}

      {activeTab === "reembolsos" && <ReimbursementsTab data={data} />}

      {activeTab === "andamento" && <ProgressTimeline data={data} onReview={() => setTab("documentos")} />}

      {activeTab === "geral" && (
        <div className="mvp-settings-grid">
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Dados da empresa</strong>
                <span>Informados pelo próprio colaborador no primeiro acesso.</span>
              </div>
            </div>
            <dl className="info-grid">
              <Field label="Razão social" value={data.legalName} />
              <Field label="Nome fantasia" value={data.tradeName} />
              <Field label="CNPJ" value={data.cnpj ? formatCnpj(data.cnpj) : null} />
              <Field
                label="Telefone"
                value={data.phone ? onlyDigits(data.phone).replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : null}
              />
              <div className="info-field info-wide">
                <dt>Endereço</dt>
                <dd>{address || "—"}</dd>
              </div>
            </dl>
          </Card>
          <Card className="mvp-settings-card">
            <div className="mvp-section-heading">
              <div>
                <strong>Responsável</strong>
                <span>Pessoa que acessa a plataforma por esta empresa.</span>
              </div>
            </div>
            <dl className="info-grid">
              <Field label="Nome" value={data.name} />
              <Field label="E-mail" value={data.email} />
              <Field label="Cargo" value={data.jobTitle} />
              <Field label="Cadastro criado em" value={dateTime(data.createdAt)} />
            </dl>
          </Card>
        </div>
      )}

      {activeTab === "documentos" && (
        <DocumentReview canReview={canDecide && data.status === "in_review"} collaboratorId={data.id} items={data.checklist} />
      )}

      <ReasonDialog
        confirmLabel="Confirmar recusa"
        description="O colaborador verá o motivo e poderá enviar os dados de novo."
        error={rejectBank.isError}
        label="Motivo da recusa"
        onClose={() => setRejectingBank(false)}
        onConfirm={(reason) => rejectBank.mutate({ id: data.pendingBankChange!.id, reason })}
        open={rejectingBank && !!data.pendingBankChange}
        pending={rejectBank.isPending}
        title="Recusar a troca de conta"
      />

      {activeTab === "bancarios" && (
        <Card className="mvp-settings-card">
          <div className="mvp-section-heading">
            <div>
              <strong>Dados bancários</strong>
              <span>Conta para os pagamentos, informada pelo colaborador. Deve ser da própria empresa (mesmo CNPJ).</span>
            </div>
          </div>
          {data.pendingBankChange && (
            <div className="bank-request">
              <div className="mvp-section-heading">
                <div>
                  <strong>Troca de conta esperando decisão</strong>
                  <span>
                    Pedida pelo colaborador em {dateTime(data.pendingBankChange.createdAt)}. Confirme com a pessoa por um canal
                    que você já conhece antes de aprovar: troca de conta é o golpe mais comum nesse tipo de operação.
                  </span>
                </div>
                <Badge tone="warning">Em análise</Badge>
              </div>
              <dl className="info-grid">
                <div className="info-field">
                  <dt>Banco pedido</dt>
                  <dd className="bank-line">
                    <BankLogo code={data.pendingBankChange.bankCode} name={data.pendingBankChange.bankName} size={32} />
                    <span>
                      {data.pendingBankChange.bankCode} · {data.pendingBankChange.bankName}
                    </span>
                  </dd>
                </div>
                <Field label="Tipo de conta" value={data.pendingBankChange.bankAccountType === "savings" ? "Conta poupança" : "Conta corrente"} />
                <Field label="Agência" value={data.pendingBankChange.bankAgency} />
                <Field label="Conta" value={data.pendingBankChange.bankAccount} />
                <div className="info-field info-wide">
                  <dt>Chave PIX</dt>
                  <dd>{data.pendingBankChange.pixKey || "Não informada"}</dd>
                </div>
              </dl>
              {canDecide ? (
                <div className="portal-form-actions" style={{ marginTop: 16 }}>
                  <Button disabled={approveBank.isPending || rejectBank.isPending} onClick={() => setRejectingBank(true)} variant="secondary">
                    Recusar troca
                  </Button>
                  <Button
                    disabled={approveBank.isPending || rejectBank.isPending}
                    icon="check"
                    loading={approveBank.isPending}
                    onClick={() => approveBank.mutate(data.pendingBankChange!.id)}
                  >
                    Aprovar troca
                  </Button>
                </div>
              ) : (
                <p className="form-hint" style={{ marginTop: 12 }}>
                  Pedido seu: quem decide é outra pessoa do corporativo.
                </p>
              )}
            </div>
          )}
          {data.bankCode ? (
            <dl className="info-grid">
              <div className="info-field">
                <dt>Banco</dt>
                <dd className="bank-line">
                  <BankLogo code={data.bankCode} name={data.bankName} size={32} />
                  <span>
                    {data.bankCode} · {data.bankName}
                  </span>
                </dd>
              </div>
              <Field label="Tipo de conta" value={data.bankAccountType === "savings" ? "Conta poupança" : "Conta corrente"} />
              <Field label="Agência" value={data.bankAgency} />
              <Field label="Conta" value={data.bankAccount} />
              <Field label="Titular" value={data.legalName} />
              <Field label="CNPJ do titular" value={data.cnpj ? formatCnpj(data.cnpj) : null} />
              <div className="info-field info-wide">
                <dt>Chave PIX</dt>
                <dd>{data.pixKey || "Não informada"}</dd>
              </div>
            </dl>
          ) : (
            <p className="form-hint">O colaborador ainda não informou os dados bancários.</p>
          )}
        </Card>
      )}

      {activeTab === "notas" && invoicesEnabled && <InvoicesTab data={data} />}
    </>
  )
}
