import { LEGAL } from "@/lib/legal"

export const MAIL_DOMAIN = "navelo.com.br"

// Caixas da plataforma. Trocar aqui vale para todos os e-mails.
export const MAILBOX = {
  /** disparos automáticos; ninguém lê respostas nesta caixa */
  sistema: `nao-responda@${MAIL_DOMAIN}`,
  /** atendimento: é para cá que as respostas vão */
  suporte: `suporte@${MAIL_DOMAIN}`,
  /** canal geral, o mesmo que aparece no site e nos documentos legais */
  contato: LEGAL.contactEmail || `contato@${MAIL_DOMAIN}`,
  /** assuntos de segurança e privacidade */
  seguranca: `seguranca@${MAIL_DOMAIN}`,
}

export type SenderName = "sistema" | "suporte" | "seguranca"

/**
 * Quem assina cada tipo de e-mail. Tudo que é automático sai de "não responda", mas com
 * Reply-To do suporte: se a pessoa responder, alguém lê.
 */
export const SENDERS: Record<SenderName, { from: string; replyTo: string }> = {
  sistema: { from: `Navelo <${MAILBOX.sistema}>`, replyTo: MAILBOX.suporte },
  suporte: { from: `Suporte Navelo <${MAILBOX.suporte}>`, replyTo: MAILBOX.suporte },
  seguranca: { from: `Segurança Navelo <${MAILBOX.seguranca}>`, replyTo: MAILBOX.suporte },
}
