import type { Metadata } from "next"
import Link from "next/link"
import { Icon, PageHeading } from "@/figma/ui"
import { getCollaboratorContracts } from "@/lib/collaborator-contracts"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { InvoiceForm } from "./invoice-form"

export const metadata: Metadata = { title: "Enviar nota fiscal" }

export default async function SendInvoicePage() {
  const { collaborator } = await requireActiveCollaborator()

  // contratos em que o colaborador atua (a nota se refere a um deles), com os dados que ele precisa ver
  const mine = await getCollaboratorContracts(collaborator.id)

  return (
    <>
      <div className="breadcrumb">
        <Link href="/portal/notas-fiscais">Minhas notas fiscais</Link>
        <Icon name="chevron" size={13} />
        <span>Enviar nota fiscal</span>
      </div>
      <PageHeading
        subtitle="Anexe a nota: lemos número, valor e competência e você só confere. Depois do envio, ela fica em revisão até a empresa aprovar."
        title="Enviar nota fiscal"
      />
      <InvoiceForm contracts={mine} />
    </>
  )
}
