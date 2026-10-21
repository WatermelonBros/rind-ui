import type { MetadataRoute } from "next"
import { pages } from "@/lib/docs"

export const dynamic = "force-static"

const site = "https://rind.watermelon-studio.it"

/** Every public page, so search engines (and the AI search built on them) find the docs. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/` },
    { url: `${site}/docs/` },
    ...pages.map((p) => ({ url: `${site}/docs/${p.slug}/` })),
    { url: `${site}/compare/` },
    { url: `${site}/privacy/` },
  ]
}
