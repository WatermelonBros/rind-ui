import type { MetadataRoute } from "next"

export const dynamic = "force-static"

/** Everything is public, crawlers and AI agents included. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://rind.watermelon-studio.it/sitemap.xml",
  }
}
