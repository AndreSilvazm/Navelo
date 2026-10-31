"use server"

import { revalidatePath } from "@/lib/revalidate"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { documentRequirements } from "@/db/schema"
import { requireSession } from "@/lib/auth/session"

export type FormState = { error?: string; success?: string } | undefined

export async function addRequirement(_: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession("corporate")

  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (name.length < 2) return { error: "Informe o nome do documento." }

  await db.insert(documentRequirements).values({
    companyId: session.company.id,
    name: name.slice(0, 120),
    description: description.slice(0, 300) || null,
    required: formData.get("required") === "on",
  })

  revalidatePath("/app/configuracoes")
  return { success: "Documento adicionado à lista." }
}

// Arquiva: some da lista dos novos colaboradores, mas o que já foi enviado fica registrado
export async function archiveRequirement(requirementId: string): Promise<void> {
  const session = await requireSession("corporate")
  await db
    .update(documentRequirements)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(documentRequirements.id, requirementId),
        eq(documentRequirements.companyId, session.company.id),
        isNull(documentRequirements.archivedAt),
      ),
    )
  revalidatePath("/app/configuracoes")
}
