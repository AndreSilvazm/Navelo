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

export default function Page() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} type="application/ld+json" />
      <LandingPage />
    </>
  )
}
