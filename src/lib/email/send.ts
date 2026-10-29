import "server-only"
import { Resend } from "resend"
import { IS_PRODUCTION } from "@/lib/app-env"
import { renderEmail, type EmailContent } from "./layout"
import { SENDERS, type SenderName } from "./senders"

export type SendInput = EmailContent & {
  to: string
  subject: string
  /** quem assina: sistema (padrão), suporte ou segurança */
  sender?: SenderName
}

/** Endereço de remetente em uso (o EMAIL_FROM, se existir, manda): só o endereço, para exibir. */
export function senderAddress(sender: SenderName = "sistema"): string {
  const bruto = process.env.EMAIL_FROM || SENDERS[sender].from
  return /<([^>]+)>/.exec(bruto)?.[1] ?? bruto
}

/**
 * Envia pelo Resend. O domínio navelo.com.br já está verificado lá; em desenvolvimento o
 * provedor só entrega ao dono da conta, então o conteúdo vai para o terminal em vez de falhar.
 */
export async function sendEmail(input: SendInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const { from, replyTo } = SENDERS[input.sender ?? "sistema"]
  const { html, text } = renderEmail(input)

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY não configurada")
    console.warn(`[e-mail não enviado: sem RESEND_API_KEY] para ${input.to}: ${input.subject}\n${text}`)
    return false
  }

  const { error } = await new Resend(apiKey).emails.send({
    // EMAIL_FROM continua valendo como atalho em ambiente de teste
    from: process.env.EMAIL_FROM || from,
    to: input.to,
    replyTo,
    // fora de produção o assunto avisa: ninguém confunde um teste com um aviso de verdade
    subject: IS_PRODUCTION ? input.subject : `[TESTE] ${input.subject}`,
    html,
    text,
    headers: { "X-Entity-Ref-ID": crypto.randomUUID() }, // evita o agrupamento da Gmail
  })
  if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`)
  return true
}

/**
 * Envia sem derrubar a operação que disparou o e-mail. Para avisos: se o provedor estiver fora
 * do ar, a aprovação da nota não pode falhar junto.
 */
export async function sendEmailSafe(input: SendInput): Promise<void> {
  try {
    await sendEmail(input)
  } catch (error) {
    console.error("e-mail", input.subject, "para", input.to, error instanceof Error ? error.message : error)
  }
}

/** Primeiro nome, para o cumprimento */
export const greet = (name?: string | null) => (name ? `Olá, ${name.trim().split(/\s+/)[0]}!` : "Olá!")
