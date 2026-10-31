import type { Metadata } from "next"
import Link from "next/link"
import { Icon, PageHeading } from "@/figma/ui"
import { requireActiveCollaborator } from "@/lib/collaborators"
import { ReimbursementForm } from "./reimbursement-form"

export const metadata: Metadata = { title: "Pedir reembolso" }

export default async function NewReimbursementPage() {
  await requireActiveCollaborator()
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) // AAAA-MM-DD

  return (
    <>
      <div className="breadcrumb">
        <Link href="/portal/reembolsos">Meus reembolsos</Link>
        <Icon name="chevron" size={13} />
        <span>Pedir reembolso</span>
      </div>
      <PageHeading
        subtitle="Informe a despesa e anexe os comprovantes. A empresa analisa o pedido, aprova e depois registra o pagamento."
        title="Pedir reembolso"
      />
      <ReimbursementForm today={today} />
    </>
  )
}
