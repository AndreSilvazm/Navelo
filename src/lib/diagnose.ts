/**
 * Traduz um erro técnico numa frase que alguém consiga agir em cima, sem vazar host, usuário,
 * senha ou chave. Usado pelo /api/health e pelas mensagens de erro exibidas FORA de produção.
 * Em produção, quem chama deve mostrar só uma mensagem genérica e deixar o detalhe no log.
 */
export function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string; cause?: { message?: string; code?: string } }
  const texto = `${e?.message ?? ""} ${e?.cause?.message ?? ""} ${e?.code ?? ""} ${e?.cause?.code ?? ""}`

  // erro do Storage (arquivos): a mensagem já vem pronta e sem segredo, e NÃO é erro do banco
  if (/no storage|do storage|do Storage|SUPABASE_SERVICE_ROLE_KEY|criar o bucket/i.test(texto)) return (e?.message ?? "erro no storage").replace(/\s+/g, " ").slice(0, 400)

  if (/28P01|password authentication failed/i.test(texto)) return "usuário ou senha do banco recusados"
  if (/tenant or user not found|user not found|ENOIDENTIFIER|no tenant identifier|XX000/i.test(texto)) return "usuário ou projeto do banco não reconhecido (o usuário precisa terminar em .<ref-do-projeto>)"
  if (/max clients|MaxClients|EMAXCONNSESSION|too many (connections|clients)|53300/i.test(texto)) return "limite de conexões do banco atingido (use a porta 6543, modo transação)"
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|CONNECT_TIMEOUT|EAI_AGAIN/i.test(texto)) return "não foi possível conectar ao servidor do banco"
  if (/Invalid URL|invalid connection string|ERR_INVALID_URL/i.test(texto)) return "a URL do banco está mal formada (aspas, espaço ou caractere especial sem codificar?)"
  if (/42501|permission denied/i.test(texto)) return "o usuário conecta, mas falta permissão em tabela (migração aplicada neste banco?)"
  if (/42P01|does not exist/i.test(texto)) return "tabela inexistente (migrações aplicadas neste banco?)"
  if (/row-level security|42501/i.test(texto)) return "o banco recusou a operação por uma política de segurança (RLS)"
  if (/AUTH_SECRET/i.test(texto)) return "AUTH_SECRET ausente ou curto"
  if (/APP_URL/i.test(texto)) return "APP_URL ausente"

  // sem classificação: devolve a mensagem, sem endereços de banco e com tamanho limitado
  const limpo = (e?.message ?? String(error))
    .replace(/postgres(ql)?:\/\/\S+/gi, "<url>")
    .replace(/\s+/g, " ")
    .trim()
  return limpo ? limpo.slice(0, 240) : "erro inesperado; veja o log do servidor"
}
