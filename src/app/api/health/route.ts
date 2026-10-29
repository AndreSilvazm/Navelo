import { sql } from "drizzle-orm"
import { db } from "@/db"
import { dbAdmin } from "@/db/admin"
import { APP_ENV, IS_PRODUCTION } from "@/lib/app-env"
import { getAuthSecret } from "@/lib/env"

// Sempre sob demanda: o resultado depende das variáveis do servidor em execução, não do build.
export const dynamic = "force-dynamic"

/**
 * Diagnóstico de configuração: diz QUAL dependência está falhando, sem mostrar nenhum segredo.
 *
 * Em produção responde só "ok" ou "falhou" (não ensina nada a quem não deve saber). Fora de
 * produção detalha, e é aí que ele serve: um 500 genérico numa página vira "senha do banco
 * admin recusada" ou "AUTH_SECRET curto" numa única requisição.
 */

type Check = { status: "ok" | "falhou"; detalhe?: string }
const ok: Check = { status: "ok" }
const falhou = (detalhe: string): Check => ({ status: "falhou", detalhe })

// Traduz o erro do driver numa frase útil, sem vazar host, usuário ou senha
function explicar(error: unknown): string {
  const e = error as { code?: string; message?: string; cause?: { message?: string; code?: string } }
  const texto = `${e?.message ?? ""} ${e?.cause?.message ?? ""} ${e?.code ?? ""} ${e?.cause?.code ?? ""}`
  if (/28P01|password authentication failed/i.test(texto)) return "usuário ou senha do banco recusados"
  if (/tenant or user not found|user not found|ENOIDENTIFIER|no tenant identifier|XX000/i.test(texto)) return "usuário ou projeto não reconhecido (o usuário precisa terminar em .<ref-do-projeto>)"
  if (/max clients|MaxClients|too many (connections|clients)/i.test(texto)) return "limite de conexões do pooler atingido"
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|CONNECT_TIMEOUT|EAI_AGAIN/i.test(texto)) return "não foi possível conectar ao servidor do banco"
  if (/Invalid URL|invalid connection string|ERR_INVALID_URL/i.test(texto)) return "a URL do banco está mal formada (aspas, espaço ou caractere especial sem codificar?)"
  if (/42501|permission denied/i.test(texto)) return "o usuário conecta, mas falta permissão em tabela (migração 0021 aplicada?)"
  if (/42P01|does not exist/i.test(texto)) return "tabela inexistente (migrações aplicadas neste banco?)"
  return "erro inesperado; veja o log do servidor"
}

const limite = <T,>(promessa: Promise<T>, ms = 8000) =>
  Promise.race([promessa, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("CONNECT_TIMEOUT")), ms))])

async function testar(nome: string, executar: () => Promise<unknown>): Promise<Check> {
  try {
    await limite(executar())
    return ok
  } catch (error) {
    console.error(`[health] ${nome}:`, error instanceof Error ? error.message : error)
    return falhou(explicar(error))
  }
}

export async function GET() {
  const checks: Record<string, Check> = {}

  // variáveis de execução (só presença e formato, nunca o valor)
  try {
    getAuthSecret()
    checks.AUTH_SECRET = ok
  } catch {
    checks.AUTH_SECRET = falhou("ausente ou com menos de 32 caracteres")
  }
  checks.APP_URL = process.env.APP_URL?.trim() ? ok : falhou("ausente (links de e-mail sairiam com o endereço errado)")
  checks.DATABASE_URL = process.env.DATABASE_URL ? ok : falhou("ausente")
  checks.DATABASE_ADMIN_URL = process.env.DATABASE_ADMIN_URL ? ok : falhou("ausente (sem ela o modo RLS fica desligado e o login/convite usam outra conexão)")

  // conexões de verdade, pelos mesmos clientes que a aplicação usa
  if (checks.DATABASE_URL.status === "ok") checks.banco_app = await testar("banco_app", () => db.execute(sql`select 1`))
  if (checks.DATABASE_ADMIN_URL.status === "ok") {
    checks.banco_admin = await testar("banco_admin", () => dbAdmin.execute(sql`select 1`))
    // as tabelas que o login e o convite tocam: pega migração faltando ou permissão errada
    if (checks.banco_admin.status === "ok") {
      checks.banco_admin_tabelas = await testar("banco_admin_tabelas", () =>
        dbAdmin.execute(sql`select (select count(*) from invitations) as convites, (select count(*) from sessions) as sessoes`),
      )
    }
  }

  // avisos: não derrubam o serviço, mas explicam falhas que aparecem só sob carga ou em e-mail
  const avisos: string[] = []
  if (!process.env.RESEND_API_KEY) avisos.push("RESEND_API_KEY ausente: nenhum e-mail sai (em teste o convite mostra o link na tela; em produção o convite é desfeito)")
  if (APP_ENV !== "development") {
    for (const nome of ["DATABASE_URL", "DATABASE_ADMIN_URL"] as const) {
      if (process.env[nome]?.includes(":5432/")) avisos.push(`${nome} usa a porta 5432 (modo sessão, só 15 vagas no pooler): troque para 6543 (modo transação), senão novas conexões são recusadas sob uso`)
    }
  }

  const tudoCerto = Object.values(checks).every((c) => c.status === "ok")
  const headers = { "Cache-Control": "no-store" }
  const status = tudoCerto ? 200 : 503

  if (IS_PRODUCTION) return Response.json({ ok: tudoCerto }, { status, headers })
  return Response.json({ ok: tudoCerto, ambiente: APP_ENV, checks, avisos }, { status, headers })
}
