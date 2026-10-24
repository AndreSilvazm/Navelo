import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/site"

// Só a landing e os textos legais são públicos; as áreas logadas e a API ficam fora dos buscadores.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/privacidade", "/termos"], disallow: ["/app", "/portal", "/api", "/acesso", "/convite", "/login"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
