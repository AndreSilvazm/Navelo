import "server-only"
import { getFile } from "@/lib/storage"

/**
 * Lê o arquivo de onde ele estiver: do bucket, quando a linha já tem caminho, ou da coluna
 * antiga enquanto a migração não passou por ela.
 */
export async function readStoredFile(row: { storagePath: string | null; content: Buffer | null }): Promise<Buffer | null> {
  if (row.storagePath) return getFile(row.storagePath)
  return row.content ?? null
}

/** Cabeçalhos de uma resposta de arquivo (mesma regra para documento e nota fiscal) */
export function fileHeaders(input: { fileName: string; mimeType: string; baixando: boolean; etag: string }) {
  return {
    ETag: input.etag,
    // revalida sempre: assim toda visualização passa pelo servidor e entra na auditoria
    "Cache-Control": "private, no-cache",
    "Content-Type": input.mimeType,
    "Content-Disposition": `${input.baixando ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
    "X-Content-Type-Options": "nosniff",
  }
}
