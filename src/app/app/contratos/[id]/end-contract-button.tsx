"use client"

import { Popconfirm } from "antd"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/figma/ui"
import { endContract } from "../actions"

// Encerra o contrato depois de uma confirmação (não dá para desfazer)
export function EndContractButton({ contractId, variant = "secondary" }: { contractId: string; variant?: "secondary" | "ghost" }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  return (
    <Popconfirm
      cancelText="Voltar"
      description="O contrato sai de vigência e fica no histórico. O colaborador fica livre para ter um contrato novo. Não dá para desfazer."
      okButtonProps={{ danger: true, loading: pending }}
      okText="Encerrar contrato"
      onConfirm={() =>
        start(async () => {
          await endContract(contractId)
          setOpen(false)
          router.refresh()
        })
      }
      onOpenChange={setOpen}
      open={open}
      title="Encerrar este contrato?"
    >
      <span>
        <Button disabled={pending} variant={variant}>
          Encerrar contrato
        </Button>
      </span>
    </Popconfirm>
  )
}
