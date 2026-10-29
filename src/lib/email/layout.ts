import { SITE_URL } from "@/lib/site"
import { MAILBOX } from "./senders"

// Paleta e medidas iguais às da plataforma, mas em estilo embutido: cliente de e-mail não
// carrega CSS externo, e vários ignoram <style> no topo.
const COLOR = {
  ink: "#101722",
  muted: "#5b6678",
  primary: "#385bff",
  border: "#e5e9f2",
  surface: "#ffffff",
  canvas: "#f4f7ff",
  warnBg: "#fff7e6",
  warnText: "#8a5a00",
}

const FONT = "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif"

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// O texto chega sempre como texto puro: escapa tudo e só depois converte **assim** em negrito.
// Com isso nenhum dado vindo de usuário consegue injetar HTML no e-mail.
const inline = (value: string) => escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

const semMarcacao = (value: string) => value.replace(/\*\*(.+?)\*\*/g, "$1")

export type EmailFact = { label: string; value: string }

export type EmailContent = {
  /** linha que o cliente mostra na prévia, ao lado do assunto */
  preheader: string
  heading: string
  greeting?: string | null
  /** parágrafos em texto puro; **negrito** é aceito */
  paragraphs: string[]
  button?: { label: string; url: string }
  /** bloco de dados (ex.: conta anterior e nova) */
  facts?: EmailFact[]
  factsTitle?: string
  /** aviso em destaque, para alertas de segurança */
  warning?: string
  /** observação final, em letra menor */
  note?: string
}

function factsTable(facts: EmailFact[], title?: string) {
  const linhas = facts
    .map(
      (f) =>
        `<tr><td style="padding:6px 0;color:${COLOR.muted};font-size:13px;width:42%;vertical-align:top">${escapeHtml(f.label)}</td>` +
        `<td style="padding:6px 0;color:${COLOR.ink};font-size:14px;font-weight:600">${escapeHtml(f.value)}</td></tr>`,
    )
    .join("")
  const cabecalho = title
    ? `<tr><td colspan="2" style="padding-bottom:10px;color:${COLOR.ink};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${escapeHtml(title)}</td></tr>`
    : ""
  return (
    `<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" ` +
    `style="margin:4px 0 22px;padding:16px;background:${COLOR.canvas};border:1px solid ${COLOR.border};border-radius:12px">${cabecalho}${linhas}</table>`
  )
}

/** Monta o HTML e a versão em texto puro (a de texto conta pontos contra o filtro de spam). */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragrafos = content.paragraphs
    .map((p) => `<p style="margin:0 0 16px;color:${COLOR.muted};font-size:15px;line-height:1.65">${inline(p)}</p>`)
    .join("")

  const botao = content.button
    ? `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:4px 0 22px">` +
      `<tr><td style="border-radius:10px;background:${COLOR.primary}">` +
      `<a href="${escapeHtml(content.button.url)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(content.button.label)}</a>` +
      `</td></tr></table>`
    : ""

  const aviso = content.warning
    ? `<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="margin:0 0 20px;background:${COLOR.warnBg};border-radius:10px">` +
      `<tr><td style="padding:14px 16px;color:${COLOR.warnText};font-size:14px;line-height:1.6">${inline(content.warning)}</td></tr></table>`
    : ""

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.canvas};font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background:${COLOR.canvas};padding:32px 16px">
<tr><td align="center">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="560" style="width:100%;max-width:560px">
<tr><td style="padding:0 0 20px">
<a href="${SITE_URL}" style="color:${COLOR.primary};font-size:26px;font-weight:700;letter-spacing:-.5px;text-decoration:none">navelo</a>
</td></tr>
<tr><td style="padding:32px;background:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:16px">
<h1 style="margin:0 0 18px;color:${COLOR.ink};font-size:22px;font-weight:700;line-height:1.3">${escapeHtml(content.heading)}</h1>
${content.greeting ? `<p style="margin:0 0 16px;color:${COLOR.ink};font-size:15px">${escapeHtml(content.greeting)}</p>` : ""}
${paragrafos}
${aviso}
${content.facts?.length ? factsTable(content.facts, content.factsTitle) : ""}
${botao}
${content.note ? `<p style="margin:0;color:${COLOR.muted};font-size:13px;line-height:1.6">${inline(content.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 8px;color:${COLOR.muted};font-size:12px;line-height:1.7">
Navelo &middot; gestão de colaboradores PJ<br>
Dúvidas? Escreva para <a href="mailto:${MAILBOX.suporte}" style="color:${COLOR.primary}">${MAILBOX.suporte}</a>. Este e-mail é automático, mas respondê-lo chega ao suporte.<br>
<a href="${SITE_URL}/privacidade" style="color:${COLOR.muted}">Política de Privacidade</a> &middot; <a href="${SITE_URL}/termos" style="color:${COLOR.muted}">Termos de Uso</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    content.heading,
    "",
    content.greeting ?? "",
    ...content.paragraphs.map(semMarcacao),
    content.warning ? `! ${semMarcacao(content.warning)}` : "",
    ...(content.facts?.length
      ? ["", ...(content.factsTitle ? [content.factsTitle.toUpperCase()] : []), ...content.facts.map((f) => `${f.label}: ${f.value}`)]
      : []),
    content.button ? `\n${content.button.label}: ${content.button.url}` : "",
    content.note ? `\n${semMarcacao(content.note)}` : "",
    "",
    "--",
    `Navelo · Dúvidas? ${MAILBOX.suporte}`,
    `${SITE_URL}/privacidade · ${SITE_URL}/termos`,
  ]
    .filter((line) => line !== "")
    .join("\n")

  return { html, text }
}
