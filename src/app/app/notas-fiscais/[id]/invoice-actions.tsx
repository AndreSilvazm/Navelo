"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/figma/ui"
import { ReasonDialog } from "@/components/reason-dialog"
import { approveInvoice, markInvoicePaid, rejectInvoice } from "../../colaboradores/actions"

type Status = "submitted" | "approved" | "rejected" | "paid"

// Decisões sobre a nota: aprovar, recusar (pede o motivo num modal) e, depois, marcar como paga.
// Cada decisão grava a data e quem a tomou.
export function InvoiceActions({ invoiceId, isSelf, number, status }: { invoiceId: string; isSelf: boolean; number: string; status: Status }) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)

  const done = () => router.refresh() // recarrega a página com o novo status e as datas
  const approve = useMutation({ mutationFn: () => approveInvoice(invoiceId), onSuccess: done })
  const pay = useMutation({ mutationFn: () => markInvoicePaid(invoiceId), onSuccess: done })
  const reject = useMutation({
    mutationFn: (reason: string) => {
      const form = new FormData()
      form.set("reason", reason)
      return rejectInvoice(invoiceId, form)
    },
    onSuccess: () => {
      setRejecting(false)
      done()
    },
  })
  const busy = approve.isPending || pay.isPending || reject.isPending

  // a própria pessoa não aprova, recusa nem paga a sua nota
  if (isSelf) return <span className="form-hint">Nota sua: a decisão é de outra pessoa do corporativo.</span>

  return (
    <>
      {status === "submitted" && (
        <>
          <Button disabled={busy} onClick={() => setRejecting(true)} variant="secondary">
            Recusar
          </Button>
          <Button disabled={busy} icon="check" loading={approve.isPending} onClick={() => approve.mutate()}>
            Aprovar
          </Button>
        </>
      )}
      {status === "approved" && (
        <Button disabled={busy} icon="payment" loading={pay.isPending} onClick={() => pay.mutate()}>
          Marcar como paga
        </Button>
      )}

      <ReasonDialog
        confirmLabel="Confirmar recusa"
        description="O colaborador verá o motivo. A data e quem recusou ficam registrados."
        error={reject.isError}
        label="Motivo da recusa"
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => reject.mutate(reason)}
        open={rejecting}
        pending={reject.isPending}
        title={`Recusar a nota nº ${number}?`}
      />
    </>
  )
}
