"use client"

import { Popconfirm } from "antd"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Badge, Button, Icon } from "@/figma/ui"
import { archiveRequirement } from "./requirements-actions"

// Um documento exigido de todo colaborador: nome, orientação, se é obrigatório e a opção de remover
export function RequirementItem({ id, name, description, required }: { id: string; name: string; description: string | null; required: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <li className={`req-card${required ? " is-required" : ""}`}>
      <span aria-hidden="true" className="req-icon">
        <Icon name="document" size={20} />
      </span>
      <div className="req-main">
        <div className="req-title">
          <strong>{name}</strong>
          <Badge tone={required ? "warning" : "neutral"}>{required ? "Obrigatório" : "Opcional"}</Badge>
        </div>
        {description ? <span className="req-hint">{description}</span> : <span className="req-hint muted">Sem orientação para o colaborador.</span>}
      </div>
      <Popconfirm
        cancelText="Voltar"
        description="Ele deixa de ser pedido aos novos colaboradores. O que já foi enviado continua registrado."
        okButtonProps={{ danger: true, loading: pending }}
        okText="Remover"
        onConfirm={() =>
          start(async () => {
            await archiveRequirement(id)
            router.refresh()
          })
        }
        title="Remover este documento da lista?"
      >
        <span>
          <Button disabled={pending} variant="ghost">
            Remover
          </Button>
        </span>
      </Popconfirm>
    </li>
  )
}
