import type { Metadata } from "next"
import Link from "next/link"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { collaborators, memberships, users } from "@/db/schema"
import { Icon, PageHeading } from "@/figma/ui"
import { CORPORATE_ROLES, requireSession } from "@/lib/auth/session"
import { ROLE_LABELS } from "@/lib/auth/permissions"
import { collaboratorOption } from "../options"
import { ContractForm } from "./contract-form"

export const metadata: Metadata = { title: "Novo contrato" }

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ colaborador?: string }> }) {
  const [session, { colaborador }] = await Promise.all([requireSession("corporate"), searchParams])

  const [members, active] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.companyId, session.company.id),
          eq(memberships.status, "active"),
          inArray(memberships.role, [...CORPORATE_ROLES]),
        ),
      )
      .orderBy(asc(users.name)),
    db
      .select({ id: collaborators.id, name: users.name, legalName: collaborators.legalName, cnpj: collaborators.cnpj, jobTitle: collaborators.jobTitle })
      .from(collaborators)
      .innerJoin(memberships, eq(memberships.id, collaborators.membershipId))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(collaborators.companyId, session.company.id),
          eq(collaborators.status, "active"),
          eq(memberships.status, "active"),
          // quem já tem contrato ativo não aparece: é um contrato por colaborador
          sql`not exists (select 1 from contracts k where k.collaborator_id = ${collaborators.id} and k.status = 'active')`,
        ),
      )
      .orderBy(asc(users.name)),
  ])

  return (
    <>
      <div className="breadcrumb">
        <Link href="/app/contratos">Contratos</Link>
        <Icon name="chevron" size={13} />
        <span>Novo contrato</span>
      </div>
      <PageHeading subtitle="Escolha o colaborador, defina o período e o que precisa ser entregue." title="Novo contrato" />
      <ContractForm
        collaborators={active.map(collaboratorOption)}
        currentUserId={session.user.id}
        preselected={active.some((c) => c.id === colaborador) ? colaborador : undefined}
        members={members.map((m) => ({ id: m.id, label: `${m.name} · ${ROLE_LABELS[m.role]}` }))}
      />
    </>
  )
}
