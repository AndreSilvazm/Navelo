import { headers } from "next/headers"
import { LandingPage } from "@/figma/site"
import { LEGAL } from "@/lib/legal"
import { SITE, SITE_URL } from "@/lib/site"

// Dados estruturados (schema.org) para os buscadores entenderem o que é o site.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE.name,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/navelo-logo.svg`,
      email: LEGAL.contactEmail,
    },
    { "@type": "WebSite", name: SITE.name, url: SITE_URL, inLanguage: "pt-BR", description: SITE.description },
    {
      "@type": "SoftwareApplication",
      name: SITE.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      description: SITE.description,
    },
  ],
}

// "<" escapado para o JSON jamais conseguir fechar a tag <script>
const jsonLdHtml = JSON.stringify(jsonLd).replaceAll("<", "\\u003c")

export default async function Page() {
  // o nonce da CSP vem do proxy; sem ele o navegador bloqueia o bloco abaixo
  const nonce = (await headers()).get("x-nonce") ?? undefined

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: jsonLdHtml }} nonce={nonce} type="application/ld+json" />
      <LandingPage />
    </>
  )
}
