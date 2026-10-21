import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Marked } from "marked"
import type { Metadata } from "next"
import styles from "./compare.module.css"

export const metadata: Metadata = {
  title: "rind-ui compared to other headless libraries",
  description:
    "How rind-ui differs from React Aria, Radix, Base UI, Ark UI and Headless UI: where it is ahead, where they are, and when to pick them instead.",
  // the same page as plain markdown, for agents (scripts/content.ts)
  alternates: { types: { "text/markdown": "/compare.md" } },
}

/** The one page of the site that names other libraries: an honest comparison (content/compare.md). */
export default function ComparePage() {
  const markdown = readFileSync(join(process.cwd(), "content/generated/compare.md"), "utf8")
  const html = new Marked({ gfm: true }).parse(markdown, { async: false })
  return (
    <main className={styles.page}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own markdown, rendered at build time */}
      <article className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
