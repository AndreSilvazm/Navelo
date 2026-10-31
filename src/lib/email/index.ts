import "server-only"
import { SITE_URL } from "@/lib/site"
import { MAILBOX } from "./senders"
import { greet, sendEmail, sendEmailSafe } from "./send"
import type { EmailFact } from "./layout"

export { MAILBOX, SENDERS } from "./senders"
export { renderEmail, type EmailContent } from "./layout"
export { sendEmail, sendEmailSafe } from "./send"

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const papel: Record<string, string> = { owner: "proprietário", admin: "administrador", agent: "agente", collaborator: "colaborador" }

/** Conta bancária em linhas legíveis, para o e-mail mostrar o que muda */
export function bankFacts(conta: { banco?: string | null; agencia?: string | null; conta?: string | null; tipo?: string | null; pix?: string | null }): EmailFact[] {
  return [
    { label: "Banco", value: conta.banco ?? "—" },
    { label: "Agência", value: conta.agencia ?? "—" },
    { label: "Conta", value: conta.conta ?? "—" },
    { label: "Tipo", value: conta.tipo ? `Conta ${conta.tipo}` : "—" },
    { label: "Chave PIX", value: conta.pix ?? "Não informada" },
  ]
}

// ---------------------------------------------------------------- acesso

/**
 * Convite para entrar na plataforma. Quem convida é a EMPRESA (o Navelo é só a plataforma que ela
 * usa): o nome dela vai no remetente, no assunto, no título e numa tabela com os dados do convite.
 * Exceção: o convite do proprietário de uma empresa nova vem do próprio Navelo, que a cadastrou.
 */
export async function sendInvitationEmail(input: {
  to: string
  name?: string | null
  companyName: string
  role: string
  jobTitle?: string | null
  /** quem da empresa enviou o convite */
  invitedByName?: string | null
  inviteUrl: string
  expiresInDays: number
}) {
  const cadastro = input.role === "owner" // empresa nova, cadastrada pela equipe do Navelo
  const como = input.jobTitle ? `para o cargo de ${input.jobTitle}` : `como ${papel[input.role] ?? input.role}`
  const fatos: EmailFact[] = [{ label: "Empresa", value: input.companyName }]
  if (input.jobTitle) fatos.push({ label: "Cargo", value: input.jobTitle })
  else fatos.push({ label: "Papel", value: papel[input.role] ?? input.role })
  if (input.invitedByName && !cadastro) fatos.push({ label: "Convite enviado por", value: input.invitedByName })

  // true se o e-mail saiu; false se só foi registrado no log (sem chave, fora de produção)
  return sendEmail({
    to: input.to,
    sender: "sistema",
    fromName: cadastro ? undefined : `${input.companyName} via Navelo`,
    subject: cadastro ? `A ${input.companyName} foi cadastrada no Navelo` : `${input.companyName} convidou você para o Navelo`,
    preheader: cadastro
      ? `Crie o seu acesso de proprietário. O link vale ${input.expiresInDays} dias.`
      : `${input.companyName} convidou você ${como}. O link vale ${input.expiresInDays} dias.`,
    heading: cadastro ? `${input.companyName} está no Navelo` : `${input.companyName} convidou você`,
    greeting: greet(input.name),
    paragraphs: cadastro
      ? [
          `A **${input.companyName}** foi cadastrada no Navelo e você é o proprietário da conta.`,
          "Crie o seu acesso no botão abaixo para começar a convidar a equipe e os colaboradores.",
        ]
      : [
          `**${input.companyName}** convidou você para acessar o Navelo, a plataforma que ela usa para acompanhar contratos, documentos e notas fiscais dos colaboradores PJ.`,
          "Para começar, crie o seu acesso no botão abaixo. Você mesmo define a sua senha.",
        ],
    factsTitle: "Dados do convite",
    facts: fatos,
    button: { label: "Aceitar convite", url: input.inviteUrl },
    note: cadastro
      ? `O link vale por ${input.expiresInDays} dias e só pode ser usado uma vez.`
      : `O convite é da **${input.companyName}**: o Navelo apenas entrega a mensagem. O link vale por ${input.expiresInDays} dias e só pode ser usado uma vez. Se você não conhece essa empresa ou não esperava este convite, ignore este e-mail.`,
  })
}

/** Link para criar uma senha nova */
export async function sendPasswordResetEmail(input: { to: string; name?: string | null; resetUrl: string; expiresInMinutes: number }) {
  await sendEmail({
    to: input.to,
    sender: "seguranca",
    subject: "Troca de senha no Navelo",
    preheader: `O link vale por ${input.expiresInMinutes} minutos.`,
    heading: "Criar uma nova senha",
    greeting: greet(input.name),
    paragraphs: ["Recebemos um pedido para trocar a senha da sua conta no Navelo."],
    button: { label: "Criar nova senha", url: input.resetUrl },
    note: `O link vale por ${input.expiresInMinutes} minutos e só pode ser usado uma vez. **Se não foi você quem pediu, ignore este e-mail**: sua senha continua a mesma.`,
  })
}

/** Aviso depois que a senha muda de verdade */
export async function sendPasswordChangedEmail(input: { to: string; name?: string | null; quando: string }) {
  await sendEmailSafe({
    to: input.to,
    sender: "seguranca",
    subject: "Sua senha do Navelo foi alterada",
    preheader: "Se não foi você, fale com o suporte agora.",
    heading: "Sua senha foi alterada",
    greeting: greet(input.name),
    paragraphs: [`A senha da sua conta no Navelo foi alterada em ${input.quando}. Por segurança, encerramos as sessões abertas em todos os aparelhos.`],
    warning: `**Não foi você?** Escreva agora para ${MAILBOX.suporte}: alguém pode ter acesso ao seu e-mail.`,
    button: { label: "Entrar no Navelo", url: `${SITE_URL}/login` },
  })
}

// ---------------------------------------------------------------- cadastro

export async function sendCollaboratorApprovedEmail(input: { to: string; name?: string | null; companyName: string }) {
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: `Seu acesso em ${input.companyName} foi liberado`,
    preheader: "Cadastro aprovado: já dá para enviar notas fiscais.",
    heading: "Acesso liberado",
    greeting: greet(input.name),
    paragraphs: [
      `**${input.companyName}** analisou seu cadastro e liberou seu acesso ao portal.`,
      "A partir de agora você acompanha o contrato, envia as notas fiscais e vê os prazos no portal do colaborador.",
    ],
    button: { label: "Abrir o portal", url: `${SITE_URL}/portal` },
  })
}

export async function sendCollaboratorRejectedEmail(input: { to: string; name?: string | null; companyName: string; motivo: string }) {
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: `Seu cadastro em ${input.companyName} não foi liberado`,
    preheader: "Veja o motivo informado pela empresa.",
    heading: "Cadastro não liberado",
    greeting: greet(input.name),
    paragraphs: [`**${input.companyName}** analisou seu cadastro e não liberou o acesso.`],
    facts: [{ label: "Motivo informado", value: input.motivo }],
    note: "Se achar que houve engano, fale diretamente com a empresa.",
  })
}

// ---------------------------------------------------------------- conta bancária

/** Avisa a empresa que alguém pediu para trocar a conta de recebimento */
export async function sendBankChangeRequestedEmail(input: {
  to: string
  name?: string | null
  collaboratorName: string
  collaboratorId: string
  de: EmailFact[]
  para: EmailFact[]
}) {
  await sendEmailSafe({
    to: input.to,
    sender: "seguranca",
    subject: `Pedido de troca de conta bancária: ${input.collaboratorName}`,
    preheader: "Confirme com a pessoa antes de aprovar.",
    heading: "Troca de conta esperando análise",
    greeting: greet(input.name),
    paragraphs: [
      `**${input.collaboratorName}** pediu para trocar a conta que recebe os pagamentos. Nada muda enquanto você não aprovar.`,
      "Antes de aprovar, confirme com a pessoa por um canal que você já conhece (telefone ou presencialmente). Trocar a conta é o golpe mais comum nesse tipo de operação, e e-mail invadido é a porta de entrada.",
    ],
    factsTitle: "Conta nova pedida",
    facts: input.para,
    button: { label: "Analisar o pedido", url: `${SITE_URL}/app/colaboradores/${input.collaboratorId}?aba=bancarios` },
  })
}

export async function sendBankChangeApprovedEmail(input: { to: string; name?: string | null; companyName: string; conta: EmailFact[] }) {
  await sendEmailSafe({
    to: input.to,
    sender: "seguranca",
    subject: "Sua nova conta bancária foi aprovada",
    preheader: "Os próximos pagamentos vão para a conta nova.",
    heading: "Conta bancária atualizada",
    greeting: greet(input.name),
    paragraphs: [`**${input.companyName}** aprovou a troca da sua conta. Os próximos pagamentos vão para a conta abaixo.`],
    factsTitle: "Conta em vigor",
    facts: input.conta,
    warning: `**Não foi você quem pediu essa troca?** Avise a empresa e escreva para ${MAILBOX.suporte} imediatamente.`,
  })
}

export async function sendBankChangeRejectedEmail(input: { to: string; name?: string | null; companyName: string; motivo: string }) {
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: "Sua troca de conta bancária foi recusada",
    preheader: "A conta anterior continua valendo.",
    heading: "Troca de conta recusada",
    greeting: greet(input.name),
    paragraphs: [`**${input.companyName}** recusou o pedido de troca da sua conta bancária. A conta anterior continua recebendo os pagamentos.`],
    facts: [{ label: "Motivo informado", value: input.motivo }],
    button: { label: "Corrigir e enviar de novo", url: `${SITE_URL}/portal/perfil` },
  })
}

// ---------------------------------------------------------------- notas fiscais

export async function sendInvoiceApprovedEmail(input: { to: string; name?: string | null; companyName: string; numero: string; competencia: string; valorCentavos: number }) {
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: `Nota ${input.numero} aprovada`,
    preheader: "Aprovada e na fila de pagamento.",
    heading: "Nota fiscal aprovada",
    greeting: greet(input.name),
    paragraphs: [`**${input.companyName}** aprovou a sua nota. Ela entra na fila de pagamento; avisamos de novo quando o pagamento for registrado.`],
    facts: [
      { label: "Nota", value: `nº ${input.numero}` },
      { label: "Competência", value: input.competencia },
      { label: "Valor", value: brl(input.valorCentavos) },
    ],
    button: { label: "Ver minhas notas", url: `${SITE_URL}/portal/notas-fiscais` },
  })
}

export async function sendInvoiceRejectedEmail(input: { to: string; name?: string | null; companyName: string; numero: string; competencia: string; motivo: string }) {
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: `Nota ${input.numero} recusada`,
    preheader: "Veja o motivo e envie de novo.",
    heading: "Nota fiscal recusada",
    greeting: greet(input.name),
    paragraphs: [`**${input.companyName}** recusou a nota nº ${input.numero}, de competência ${input.competencia}.`],
    facts: [{ label: "Motivo informado", value: input.motivo }],
    button: { label: "Enviar nota corrigida", url: `${SITE_URL}/portal/notas-fiscais/enviar` },
  })
}

export async function sendInvoicePaidEmail(input: { to: string; name?: string | null; companyName: string; numero: string; competencia: string; valorCentavos: number }) {
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: `Pagamento da nota ${input.numero} registrado`,
    preheader: `${brl(input.valorCentavos)} marcados como pagos.`,
    heading: "Pagamento registrado",
    greeting: greet(input.name),
    paragraphs: [`**${input.companyName}** registrou o pagamento da nota abaixo. O crédito na sua conta depende do banco.`],
    facts: [
      { label: "Nota", value: `nº ${input.numero}` },
      { label: "Competência", value: input.competencia },
      { label: "Valor", value: brl(input.valorCentavos) },
    ],
    button: { label: "Ver minhas notas", url: `${SITE_URL}/portal/notas-fiscais` },
  })
}

// Decisão sobre um pedido de reembolso: aprovado, recusado (com o motivo) ou pago
export async function sendReimbursementEmail(input: {
  to: string
  name?: string | null
  companyName: string
  kind: "approved" | "rejected" | "paid"
  descricao: string
  valorCentavos: number
  motivo?: string
}) {
  const text = {
    approved: { subject: "Reembolso aprovado", heading: "Reembolso aprovado", body: `**${input.companyName}** aprovou o seu pedido de reembolso. O pagamento será registrado em seguida.` },
    rejected: { subject: "Reembolso recusado", heading: "Reembolso recusado", body: `**${input.companyName}** não aprovou o seu pedido de reembolso.` },
    paid: { subject: "Reembolso pago", heading: "Reembolso pago", body: `**${input.companyName}** registrou o pagamento do seu reembolso. O crédito na sua conta depende do banco.` },
  }[input.kind]
  await sendEmailSafe({
    to: input.to,
    sender: "sistema",
    subject: `${text.subject}: ${brl(input.valorCentavos)}`,
    preheader: input.kind === "rejected" ? "Veja o motivo no portal." : `${brl(input.valorCentavos)}.`,
    heading: text.heading,
    greeting: greet(input.name),
    paragraphs: [text.body],
    facts: [
      { label: "Despesa", value: input.descricao },
      { label: "Valor", value: brl(input.valorCentavos) },
      ...(input.kind === "rejected" && input.motivo ? [{ label: "Motivo", value: input.motivo }] : []),
    ],
    button: { label: "Ver meus reembolsos", url: `${SITE_URL}/portal/reembolsos` },
  })
}
