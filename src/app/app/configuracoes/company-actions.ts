"use server"

import { revalidatePath } from "@/lib/revalidate"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { companies } from "@/db/schema"
import { requireSession } from "@/lib/auth/session"

export type CompanyState = { error?: string; success?: string } | undefined

// Só o nome de exibição (nome fantasia) é editável: razão social e CNPJ são o cadastro legal da empresa.
export async function updateTradeName(_: CompanyState, formData: FormData): Promise<CompanyState> {
  const session = await requireSession("corporate")
  if (session.role !== "owner" && session.role !== "admin") return { error: "Só o proprietário ou um administrador altera os dados da empresa." }

  const tradeName = String(formData.get("tradeName") ?? "").trim().replace(/\s+/g, " ")
  if (tradeName.length > 100) return { error: "Nome muito longo (máximo 100 caracteres)." }

  await db
    .update(companies)
    .set({ tradeName: tradeName || null })
    .where(eq(companies.id, session.company.id))

  revalidatePath("/app", "layout")
  return { success: "Nome da empresa atualizado." }
}
