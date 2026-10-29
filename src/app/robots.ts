import type { MetadataRoute } from "next"
import { IS_PRODUCTION } from "@/lib/app-env"
import { SITE_URL } from "@/lib/site"

export const dynamic = "force-dynamic" // segue o ambiente em execução, não o do build

// Só a landing e os textos legais são públicos; as áreas logadas e a API ficam fora dos buscadores.
export default function robots(): MetadataRoute.Robots {
  // fora de produção: nada é indexado
  if (!IS_PRODUCTION) return { rules: { userAgent: "*", disallow: "/" } }
  return {
    rules: { userAgent: "*", allow: ["/", "/privacidade", "/termos"], disallow: ["/app", "/portal", "/api", "/acesso", "/convite", "/login"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
