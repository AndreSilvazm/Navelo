import "server-only"
import { revalidatePath as nextRevalidatePath } from "next/cache"
import { invalidateCached } from "@/lib/ttl-cache"

/**
 * Use este `revalidatePath` nas ações (no lugar do de "next/cache"). Além de atualizar a página,
 * ele descarta o cache em memória (src/lib/ttl-cache.ts). Assim, quem acabou de aprovar uma nota,
 * criar um contrato etc. vê o resultado na hora, e o cache só "segura" os dados que não mudaram.
 *
 * Limite: o cache em memória é por instância do servidor. Outra instância pode mostrar o dado
 * antigo por até o tempo de vida do cache (30 s a 60 s).
 */
export function revalidatePath(path: string, type?: "page" | "layout") {
  invalidateCached("")
  nextRevalidatePath(path, type)
}
