/**
 * Move os arquivos que estão na coluna `content` (Postgres) para o Supabase Storage.
 *
 *   npm run files:migrate            # mostra o que faria, sem gravar
 *   npm run files:migrate -- --apply # migra de verdade
 *   npm run files:migrate -- --apply --limpar   # migra e zera a coluna antiga
 *
 * Seguro de rodar mais de uma vez: só pega linha que ainda não tem caminho no bucket.
 * Sem --limpar, o conteúdo antigo continua no banco como rede de segurança — confira que
 * está tudo abrindo e só então rode com --limpar.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { db } from "../src/db"
import { collaboratorDocuments, collaborators, invoices } from "../src/db/schema"
import { documentPath, ensureBucket, invoicePath, putFile } from "../src/lib/storage"

const aplicar = process.argv.includes("--apply")
const limpar = process.argv.includes("--limpar")

async function main() {
  const bucket = await ensureBucket()
  console.log(bucket.criado ? `bucket "${bucket.bucket}" criado (privado)` : `bucket "${bucket.bucket}" já existia`)

  // ---- documentos do cadastro
  const docs = await db
    .select({
      id: collaboratorDocuments.id,
      requirementId: collaboratorDocuments.requirementId,
      collaboratorId: collaboratorDocuments.collaboratorId,
      companyId: collaborators.companyId,
      mimeType: collaboratorDocuments.mimeType,
      content: collaboratorDocuments.content,
      fileName: collaboratorDocuments.fileName,
    })
    .from(collaboratorDocuments)
    .innerJoin(collaborators, eq(collaborators.id, collaboratorDocuments.collaboratorId))
    .where(and(isNull(collaboratorDocuments.storagePath), isNotNull(collaboratorDocuments.content)))

  // ---- notas fiscais
  const notas = await db
    .select({
      id: invoices.id,
      collaboratorId: invoices.collaboratorId,
      companyId: invoices.companyId,
      mimeType: invoices.mimeType,
      content: invoices.content,
      number: invoices.number,
    })
    .from(invoices)
    .where(and(isNull(invoices.storagePath), isNotNull(invoices.content)))

  const total = docs.length + notas.length
  const bytes = [...docs, ...notas].reduce((soma, r) => soma + (r.content?.length ?? 0), 0)
  console.log(`${docs.length} documento(s) e ${notas.length} nota(s) a migrar — ${(bytes / 1024 / 1024).toFixed(1)} MB`)
  if (!aplicar) return console.log("simulação: nada foi gravado. Rode de novo com --apply.")
  if (total === 0) return

  let feitos = 0
  for (const d of docs) {
    if (!d.content) continue
    const caminho = documentPath(d.companyId, d.collaboratorId, d.requirementId, d.mimeType)
    await putFile(caminho, d.content, d.mimeType)
    await db
      .update(collaboratorDocuments)
      .set({ storagePath: caminho, ...(limpar ? { content: null } : {}) })
      .where(eq(collaboratorDocuments.id, d.id))
    console.log(`  documento ${d.fileName} → ${caminho}`)
    feitos++
  }
  for (const n of notas) {
    if (!n.content) continue
    const caminho = invoicePath(n.companyId, n.collaboratorId, n.id, n.mimeType)
    await putFile(caminho, n.content, n.mimeType)
    await db
      .update(invoices)
      .set({ storagePath: caminho, ...(limpar ? { content: null } : {}) })
      .where(eq(invoices.id, n.id))
    console.log(`  nota nº ${n.number} → ${caminho}`)
    feitos++
  }
  console.log(`${feitos} arquivo(s) migrado(s).${limpar ? " Coluna antiga zerada." : " Coluna antiga mantida (rode com --limpar depois de conferir)."}`)
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro)
    process.exit(1)
  })
