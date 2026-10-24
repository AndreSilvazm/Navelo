// Leitura automática da nota fiscal: número, valor e competência. Roda no navegador, no arquivo
// escolhido, e serve só para PRÉ-PREENCHER o formulário: quem cadastra sempre confere e pode editar.
// Funciona com PDF que tenha texto e com XML de NFS-e/NF-e. Imagens e PDFs escaneados não têm
// texto para ler, então voltam vazios e a pessoa preenche à mão.

export type ExtractedInvoice = {
  number?: string
  amountCents?: number
  /** AAAA-MM-DD */
  competence?: string
}

const stripZeros = (n: string) => n.replace(/^0+(?=\d)/, "")

// "1.234,56" -> 123456
const toCents = (v: string) => Math.round(parseFloat(v.replace(/\./g, "").replace(",", ".")) * 100)

function validDate(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

// ---------- texto livre (PDF) ----------
const AMOUNT_LABELS = [
  "valor total da nfs-?e",
  "valor total da nota",
  "valor da nota",
  "valor total dos servi[cç]os",
  "valor dos servi[cç]os",
  "valor do servi[cç]o",
  "valor l[ií]quido da nfs-?e",
  "valor l[ií]quido",
  "valor total",
]

export function parseInvoiceText(raw: string): ExtractedInvoice {
  const text = raw.replace(/\s+/g, " ")
  const out: ExtractedInvoice = {}

  const numberPatterns = [
    /n[úu]mero\s+da\s+(?:nfs-?e|nota(?:\s+fiscal)?)\s*[:\-]?\s*(\d[\d.]*)/i,
    /nfs-?e\s*(?:n[ºo°.]*)?\s*[:\-]?\s*(\d{1,15})\b/i,
    /nota\s+fiscal[^0-9]{0,40}n[ºo°.]*\s*[:\-]?\s*(\d[\d.]*)/i,
    /\bn[úu]mero\s*[:\-]?\s*(\d{1,15})\b/i,
    /\bn[ºo°]\s*[:.]?\s*(\d{1,15})\b/i,
  ]
  for (const re of numberPatterns) {
    const m = text.match(re)
    if (m) {
      out.number = stripZeros(m[1].replace(/\./g, ""))
      break
    }
  }

  for (const label of AMOUNT_LABELS) {
    const m = text.match(new RegExp(`${label}[^0-9R]{0,25}(?:R\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2})`, "i"))
    if (m) {
      const cents = toCents(m[1])
      if (cents > 0) {
        out.amountCents = cents
        break
      }
    }
  }

  const comp =
    text.match(/compet[êe]ncia[^0-9]{0,30}(\d{2})\/(\d{2})\/(\d{4})/i) ??
    text.match(/compet[êe]ncia[^0-9]{0,30}(\d{2})\/(\d{4})/i) ??
    text.match(/compet[êe]ncia[^0-9]{0,30}(\d{4})-(\d{2})(?:-(\d{2}))?/i)
  if (comp) {
    if (comp[0].match(/(\d{2})\/(\d{2})\/(\d{4})/)) out.competence = validDate(+comp[3], +comp[2], +comp[1]) ?? undefined
    else if (comp[0].match(/\d{4}-\d{2}/)) out.competence = validDate(+comp[1], +comp[2], comp[3] ? +comp[3] : 1) ?? undefined
    else out.competence = validDate(+comp[2], +comp[1], 1) ?? undefined
  }
  if (!out.competence) {
    // sem competência explícita: usa a data de emissão
    const e = text.match(/emiss[ãa]o[^0-9]{0,30}(\d{2})\/(\d{2})\/(\d{4})/i)
    if (e) out.competence = validDate(+e[3], +e[2], +e[1]) ?? undefined
  }
  return out
}

// ---------- XML (NFS-e nacional, ABRASF, NF-e) ----------
const tag = (xml: string, names: string[]) => {
  for (const n of names) {
    const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${n}>\\s*([^<]+?)\\s*</`, "i"))
    if (m) return m[1]
  }
  return undefined
}

export function parseInvoiceXml(xml: string): ExtractedInvoice {
  const out: ExtractedInvoice = {}
  const number = tag(xml, ["nNFSe", "Numero", "nNF"])
  if (number && /^\d+$/.test(number)) out.number = stripZeros(number)

  const amount = tag(xml, ["vServ", "ValorServicos", "vNF", "ValorLiquidoNfse"])
  if (amount && /^\d+(\.\d+)?$/.test(amount)) out.amountCents = Math.round(parseFloat(amount) * 100)

  const date = tag(xml, ["dCompet", "Competencia", "dhEmi", "DataEmissao"])
  const m = date?.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) out.competence = validDate(+m[1], +m[2], +m[3]) ?? undefined
  return out
}

// ---------- ponto de entrada ----------
export async function extractInvoice(file: File): Promise<ExtractedInvoice> {
  try {
    const name = file.name.toLowerCase()
    if (name.endsWith(".xml") || file.type.includes("xml")) return parseInvoiceXml(await file.text())

    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      // pdf.js só roda no navegador; carregado sob demanda para não pesar o resto do site
      const { pdfjs } = await import("react-pdf")
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
      let text = ""
      for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        text += " " + content.items.map((item) => ("str" in item ? item.str : "")).join(" ")
      }
      void doc.loadingTask.destroy()
      return parseInvoiceText(text)
    }
  } catch {
    // arquivo ilegível: o formulário segue manual
  }
  return {}
}
