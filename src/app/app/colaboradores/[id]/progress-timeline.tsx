"use client"

import type { ReactNode } from "react"
import { Badge, Button, Icon, type IconName } from "@/figma/ui"
import { formatCnpj } from "@/lib/cnpj"
import { statusLabel } from "../types"
import type { CollaboratorDetailData } from "./types"

type StepState = "done" | "current" | "pending" | "rejected" | "paused"
type Step = { key: string; title: string; state: StepState; date: string | null; body: ReactNode }

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null

const markerIcon: Record<StepState, IconName> = { done: "check", current: "clock", pending: "clock", rejected: "close", paused: "lock" }
const stateLabel: Record<StepState, string> = {
  done: "Concluído",
  current: "Etapa atual",
  pending: "Pendente",
  rejected: "Recusado",
  paused: "Suspenso",
}
const stateTone = { done: "success", current: "info", pending: "neutral", rejected: "danger", paused: "warning" } as const

function buildSteps(d: CollaboratorDetailData): Step[] {
  const required = d.checklist.filter((i) => i.requirement.required)
  const attached = required.filter((i) => i.document && i.document.status !== "rejected").length
  const approved = required.filter((i) => i.document?.status === "approved").length
  const rejectedDocs = d.checklist.filter((i) => i.document?.status === "rejected")
  const rejected = d.status === "rejected"
  const through = d.status === "active" || d.status === "suspended" // passou pela análise e foi liberado
  // documentos já decididos, com quem decidiu
  const reviewed = d.checklist.filter((i) => i.document && i.document.status !== "submitted" && i.document.reviewedAt)

  const steps: Step[] = [
    {
      key: "invite",
      title: "Convite enviado",
      state: "done",
      date: d.invitedAt ?? d.createdAt,
      body: d.invitedBy
        ? `${d.invitedBy} convidou ${d.name}${d.jobTitle ? ` para o cargo de ${d.jobTitle}` : ""}.`
        : `Cadastro criado${d.jobTitle ? ` para o cargo de ${d.jobTitle}` : ""}.`,
    },
    {
      key: "accepted",
      title: "Convite aceito",
      state: "done",
      date: d.inviteAcceptedAt ?? d.createdAt,
      body: `${d.name} criou a conta e acessou a plataforma (${d.email}).`,
    },
    {
      key: "profile",
      title: "Dados da empresa",
      state: d.profileCompletedAt ? "done" : d.status === "profile_pending" ? "current" : "pending",
      date: d.profileCompletedAt,
      body: d.profileCompletedAt
        ? `${d.legalName ?? "Empresa"}${d.cnpj ? ` · CNPJ ${formatCnpj(d.cnpj)}` : ""} informada.`
        : "Aguardando o colaborador preencher o CNPJ e o endereço.",
    },
    {
      key: "bank",
      title: "Dados bancários",
      // a conta PJ é a obrigatória; a pessoa física é opcional
      state: d.bankAccounts.pj ? "done" : d.status === "documents_pending" ? "current" : "pending",
      date: null,
      body: d.bankAccounts.pj
        ? `Conta PJ no ${d.bankAccounts.pj.bankName}${d.bankAccounts.pf ? `; conta pessoa física no ${d.bankAccounts.pf.bankName}` : "; sem conta pessoa física"}.`
        : "Aguardando o colaborador informar a conta PJ (da empresa) para os pagamentos.",
    },
    {
      key: "documents",
      title: "Envio dos documentos",
      state: d.status === "documents_pending" ? "current" : d.submittedAt ? "done" : "pending",
      date: d.submittedAt,
      body:
        d.status === "documents_pending" ? (
          <>
            <span>
              {attached} de {required.length} documentos obrigatórios anexados.
              {d.submittedAt && " Há documentos recusados aguardando novo envio."}
            </span>
            {rejectedDocs.map((i) => (
              <span className="timeline-note" key={i.requirement.id}>
                Recusado: {i.requirement.name}
                {i.document?.reviewNote && ` — ${i.document.reviewNote}`}
              </span>
            ))}
          </>
        ) : d.submittedAt ? (
          `Documentos enviados para análise (${d.checklist.filter((i) => i.document).length} arquivo(s)).`
        ) : (
          "O colaborador envia os documentos exigidos pela empresa depois de preencher os dados."
        ),
    },
  ]

  if (rejected) {
    steps.push({
      key: "rejected",
      title: "Acesso recusado",
      state: "rejected",
      date: d.rejectedAt,
      body: (
        <>
          <span>{d.rejectedBy ? `Recusado por ${d.rejectedBy}.` : "Acesso recusado pela empresa."}</span>
          {d.rejectionReason && <span className="timeline-note">Motivo: {d.rejectionReason}</span>}
        </>
      ),
    })
    // só mostra o que foi alcançado antes da recusa
    return steps.filter((s) => s.state !== "pending")
  }

  steps.push(
    {
      key: "review",
      title: "Análise da empresa",
      state: d.status === "in_review" ? "current" : through ? "done" : "pending",
      date: through ? d.approvedAt : null,
      body: (
        <>
          <span>
            {d.status === "in_review"
              ? `Aguardando a decisão da empresa: ${approved} de ${required.length} documentos obrigatórios aprovados.`
              : through
                ? `Todos os documentos obrigatórios foram aprovados${d.approvedBy ? `. Análise concluída por ${d.approvedBy}.` : "."}`
                : "A empresa confere os documentos e decide se libera o acesso."}
          </span>
          {reviewed.map((i) => (
            <span className="timeline-note" key={i.requirement.id}>
              {i.document?.status === "approved" ? "Aprovado" : "Recusado"}: {i.requirement.name} — por{" "}
              {i.document?.reviewedBy ?? "usuário removido"}
              {i.document?.reviewedAt && ` em ${dateTime(i.document.reviewedAt)}`}
            </span>
          ))}
        </>
      ),
    },
    {
      key: "active",
      title: "Acesso liberado",
      state: through ? "done" : "pending",
      date: through ? d.approvedAt : null,
      body:
        through
          ? d.approvedBy
            ? `Acesso liberado por ${d.approvedBy}.`
            : "Acesso liberado."
          : "Depois da aprovação, o colaborador acessa o portal, envia notas fiscais e pode ser vinculado a contratos.",
    },
  )
  if (d.status === "suspended") {
    steps.push({
      key: "suspended",
      title: "Acesso suspenso",
      state: "paused",
      date: d.suspendedAt,
      body: (
        <>
          <span>{d.suspendedBy ? `Suspenso por ${d.suspendedBy}.` : "Acesso suspenso pela empresa."}</span>
          {d.suspensionReason && <span className="timeline-note">Motivo: {d.suspensionReason}</span>}
        </>
      ),
    })
  }
  return steps
}

const banner: Record<CollaboratorDetailData["status"], string> = {
  profile_pending: "O colaborador está preenchendo os dados da empresa e bancários.",
  documents_pending: "O colaborador está enviando os documentos exigidos.",
  in_review: "Cadastro enviado: falta a análise de vocês para liberar o acesso.",
  active: "Cadastro concluído: o acesso está liberado.",
  rejected: "O acesso deste colaborador foi recusado.",
  suspended: "O acesso deste colaborador está suspenso. Ele não consegue usar a plataforma.",
}

// Linha do tempo do cadastro: o que já aconteceu, quando e por quem, e em que etapa
// exata o colaborador está agora para fazer parte da empresa.
export function ProgressTimeline({ data, onReview }: { data: CollaboratorDetailData; onReview: () => void }) {
  const steps = buildSteps(data)

  return (
    <div className="timeline-wrap">
      <div className={`timeline-banner ${data.status}`}>
        <div>
          <span>Situação atual</span>
          <strong>{banner[data.status]}</strong>
        </div>
        {data.status === "in_review" && <Button onClick={onReview}>Analisar documentos</Button>}
      </div>

      <ol className="timeline">
        {steps.map((s) => (
          <li className={`timeline-item ${s.state}`} key={s.key}>
            <span aria-hidden="true" className="timeline-marker">
              <Icon name={markerIcon[s.state]} size={16} />
            </span>
            <div className="timeline-card">
              <div className="timeline-card-head">
                <strong>{s.title}</strong>
                <Badge tone={stateTone[s.state]}>{stateLabel[s.state]}</Badge>
              </div>
              <div className="timeline-body">{s.body}</div>
              {dateTime(s.date) && <small className="form-hint">{dateTime(s.date)}</small>}
            </div>
          </li>
        ))}
      </ol>

      {data.history.length > 0 && (
        <section className="status-history">
          <h3>Histórico de status</h3>
          <ul>
            {data.history.map((e) => (
              <li key={e.id}>
                <div>
                  <strong>
                    {statusLabel[e.from]} → {statusLabel[e.to]}
                  </strong>
                  <span>
                    {e.by ?? "usuário removido"} · {dateTime(e.at)}
                  </span>
                </div>
                {e.reason && <p>{e.reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
