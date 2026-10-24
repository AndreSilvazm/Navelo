import { Resend } from "resend"

const roleLabel: Record<string, string> = {
  owner: "administrador",
  admin: "administrador",
  agent: "agente",
  collaborator: "colaborador",
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export async function sendInvitationEmail(input: {
  to: string
  name?: string | null
  companyName: string
  role: string
  inviteUrl: string
  expiresInDays: number
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada")

  const company = escapeHtml(input.companyName)
  const greeting = input.name ? `Olá, ${escapeHtml(input.name)}!` : "Olá!"

  const { error } = await new Resend(apiKey).emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    to: input.to,
    subject: `${input.companyName} convidou você para o Navelo`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#111827">
        <h2>${greeting}</h2>
        <p><strong>${company}</strong> convidou você para acessar o Navelo como ${roleLabel[input.role] ?? input.role}.</p>
        <p><a href="${input.inviteUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#fff;border-radius:8px;text-decoration:none">Aceitar convite</a></p>
        <p style="color:#6b7280;font-size:13px">O link vale por ${input.expiresInDays} dias e só pode ser usado uma vez. Se você não esperava este convite, ignore este e-mail.</p>
      </div>`,
  })
  if (error) throw new Error(`Falha ao enviar e-mail: ${error.message}`)
}
