import type { MetadataRoute } from "next"
import { LEGAL } from "@/lib/legal"
import { IS_PRODUCTION } from "@/lib/app-env"
import { SITE_URL } from "@/lib/site"

export const dynamic = "force-dynamic"

export default function sitemap(): MetadataRoute.Sitemap {
  if (!IS_PRODUCTION) return []
  const updated = new Date(LEGAL.version)
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/privacidade`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/termos`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
  ]
}
