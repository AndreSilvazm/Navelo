"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ReasonDialog } from "@/components/reason-dialog"
import { Button } from "@/figma/ui"
import type { ReimbursementStatus } from "@/lib/reimbursements"
import { approveReimbursement, markReimbursementPaid, rejectReimbursement } from "../actions"

// Decisões sobre o pedido: aprovar, recusar (pede o motivo num modal) e, depois, marcar como pago.
// Cada decisão grava a data e quem a tomou.
export function ReimbursementActions({ id, isSelf, status }: { id: string; isSelf: boolean; status: ReimbursementStatus }) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)

  const done = () => router.refresh() // recarrega a página com o novo status e as datas
  const approve = useMutation({ mutationFn: () => approveReimbursement(id), onSuccess: done })
  const pay = useMutation({ mutationFn: () => markReimbursementPaid(id), onSuccess: done })
  const reject = useMutation({
    mutationFn: (reason: string) => {
      const form = new FormData()
      form.set("reason", reason)
      return rejectReimbursement(id, form)
    },
    onSuccess: () => {
      setRejecting(false)
      done()
    },
  })
  const busy = approve.isPending || pay.isPending || reject.isPending

  // a própria pessoa não aprova, recusa nem paga o seu reembolso
  if (isSelf) return <span className="form-hint">Pedido seu: a decisão é de outra pessoa do corporativo.</span>

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
          Marcar como pago
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
        title="Recusar este pedido de reembolso?"
      />
    </>
  )
}
