import type { ReactNode } from "react"
import { SiteFooter, SiteHeader } from "@/figma/site"

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
