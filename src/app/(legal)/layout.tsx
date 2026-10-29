import type { ReactNode } from "react"
import { SiteFooter, SiteHeader } from "@/figma/site"

// A CSP leva um nonce novo a cada requisição (ver src/proxy.ts). Uma página gerada no build
// congelaria o nonce no HTML e teria os próprios scripts bloqueados — por isso, renderização sob demanda.
export const dynamic = "force-dynamic"

// Páginas públicas de texto jurídico: mesmo cabeçalho e rodapé da landing.
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <SiteHeader />
      <main className="legal" id="conteudo">
        <article className="legal-inner">{children}</article>
      </main>
      <SiteFooter />
    </div>
  )
}
