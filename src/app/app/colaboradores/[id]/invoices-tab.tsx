"use client"

import Link from "next/link"
import { Badge, Card } from "@/figma/ui"
import { formatBRL } from "@/lib/format"
import { competenceLabel, invoiceStatusLabel, invoiceStatusTone } from "@/lib/invoice-status"
import type { CollaboratorDetailData } from "./types"

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null)

// Notas fiscais do colaborador. Cada nota abre a própria página, onde a empresa confere os dados,
// compara o valor com o definido e decide (aprovar, recusar ou marcar como paga).
export function InvoicesTab({ data }: { data: CollaboratorDetailData }) {
  const list = data.invoices
  const sum = (s: string) => list.filter((i) => i.status === s).reduce((t, i) => t + i.amountCents, 0)
  const count = (s: string) => list.filter((i) => i.status === s).length

  return (
    <div className="dash">
      <div className="dash-kpis">
        <div className="dash-kpi">
          <span className="dash-kpi-label">Em revisão</span>
          <strong>{count("submitted")}</strong>
          <small>{formatBRL(sum("submitted"))} aguardando você</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Aprovadas, a pagar</span>
          <strong>{formatBRL(sum("approved"))}</strong>
          <small>{count("approved")} nota(s)</small>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Pagas</span>
          <strong>{formatBRL(sum("paid"))}</strong>
          <small>{count("paid")} nota(s)</small>
        </div>
      </div>

      <Card className="mvp-settings-card">
        <div className="mvp-section-heading">
          <div>
            <strong>Notas fiscais</strong>
            <span>Abra uma nota para conferir os dados e o valor, aprovar ou recusar e, depois, marcar como paga.</span>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="form-hint">Nenhuma nota fiscal enviada ainda.</p>
        ) : (
          <div className="nf-list">
            {list.map((i) => (
              <Link className="nf-card nf-link" href={`/app/notas-fiscais/${i.id}`} key={i.id}>
                <div className="nf-top">
                  <div className="nf-info">
                    <strong>
                      Nota nº {i.number} · {competenceLabel(i.competence)}
                    </strong>
                    <span>{[i.contractName, i.description].filter(Boolean).join(" · ") || "Sem contrato"}</span>
                    <span>Enviada em {when(i.createdAt)}</span>
                    {i.reviewedAt && i.status !== "submitted" && (
                      <span>
                        {i.status === "rejected" ? "Recusada" : "Aprovada"} em {when(i.reviewedAt)} por {i.reviewedBy ?? "usuário removido"}
                      </span>
                    )}
                    {i.paidAt && <span>Paga em {when(i.paidAt)}</span>}
                  </div>
                  <div className="nf-money">
                    <strong>{formatBRL(i.amountCents)}</strong>
                    <Badge tone={invoiceStatusTone[i.status]}>{invoiceStatusLabel[i.status]}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
