"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { listAccesses } from "@/lib/auth/accesses"
import { getSession, homeFor, setSessionAccess } from "@/lib/auth/session"

// Escolhe com qual acesso (empresa + papel) a pessoa vai usar a plataforma agora
export async function chooseAccess(membershipId: string) {
  const session = await getSession()
  if (!session) redirect("/login")

  // só vale vínculo da própria pessoa, ativo
  const access = (await listAccesses(session.user.id)).find((a) => a.membershipId === membershipId)
  if (!access) return

  await setSessionAccess(access)
  revalidatePath("/", "layout") // empresa e papel mudam em todo o app
  redirect(homeFor(access.role))
}
