import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Marked } from "marked"
import type { Metadata } from "next"
import letters from "@/components/letters.module.css"
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
      <article className={styles.prose} dangerouslySetInnerHTML={{ __html: layout(html) }} />
    </main>
  )
}

/** Gives the flat markdown its page shape: the intro, the table, one block per h2, one card per h3. */
function layout(html: string): string {
  const [intro = "", ...parts] = html.split(/(?=<h2)/)
  const sections = parts.map((part) => {
    const [head = "", ...cards] = part.split(/(?=<h3)/)
    const grid = cards.length
      ? `<div class="${styles.cards}">${cards.map((c) => `<div class="${styles.card}">${c}</div>`).join("")}</div>`
      : ""
    return `<section class="${styles.section}">${head}${grid}</section>`
  })
  const [raw = "", table = ""] = intro.split(/(?=<table)/)
  const lead = raw.replace(/<h1>([^<&]*)<\/h1>/, (_, t: string) => `<h1>${lettered(t)}</h1>`)
  return `<header class="${styles.intro}">${lead}</header>${table}${sections.join("")}`
}

/** The title's letters answer the phase, as on the landing and the docs (components/letters.tsx,
 *  as HTML: this page is markdown rendered to a string). */
function lettered(text: string): string {
  let i = 0
  const words = text
    .split(" ")
    .map(
      (w) =>
        `<span class="${letters.word}">${[...w].map((ch) => `<span class="${letters.ch}" style="--i:${i++}">${ch}</span>`).join("")}</span>`,
    )
    .join(" ")
  return `<span class="${letters.visuallyHidden}">${text}</span><span aria-hidden="true">${words}</span>`
}
