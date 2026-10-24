import type { MetadataRoute } from "next"
import { LEGAL } from "@/lib/legal"
import { SITE_URL } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(LEGAL.version)
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/privacidade`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/termos`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
  ]
}
