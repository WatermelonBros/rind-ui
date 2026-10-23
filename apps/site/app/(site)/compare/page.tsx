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
  // the libraries compared, as chips under the title (the landing's attribute chips): rind-ui
  // first and filled, the rest outlined, coming in one after another (decorative: the table
  // names them all)
  const names = [...table.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>/g)].map((m) =>
    (m[1] ?? "").replace(/<[^>]+>/g, ""),
  )
  const chips = names.length
    ? `<ul class="${styles.libs}" aria-hidden="true">${names
        .map(
          (n, i) =>
            `<li style="--i:${i}"${i === 0 ? " data-own" : ""}><a href="#lib-${slug(n)}" tabindex="-1">${n}</a></li>`,
        )
        .join("")}</ul>`
    : ""
  // the table as a picture: a bar per library for its components (planned ones ghosted), and a
  // mark per thing only some ship (drivers, machines, AI-UI). Decorative: the table is the data
  const rows = [...table.matchAll(/<tr>\s*((?:<td>[\s\S]*?<\/td>\s*)+)<\/tr>/g)].map((m) =>
    [...(m[1] ?? "").matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) =>
      (c[1] ?? "").replace(/<[^>]+>/g, ""),
    ),
  )
  const count = (t: string, re: RegExp) => Number(re.exec(t)?.[1] ?? 0)
  const top = Math.max(
    1,
    ...rows.map((r) => count(r[1] ?? "", /(\d+)/) + count(r[1] ?? "", /(\d+) planned/)),
  )
  const has = (t: string | undefined) => !!t && !/^(no|none)$/i.test(t.trim())
  const board = rows.length
    ? `<div class="${styles.board}" aria-hidden="true"><div class="${styles.boardHead}"><span></span><span>components</span><span>drivers</span><span>machines</span><span>AI-UI</span></div>${rows
        .map((r, i) => {
          const ready = count(r[1] ?? "", /(\d+)/)
          const planned = count(r[1] ?? "", /(\d+) planned/)
          const mark = (on: boolean) =>
            `<span class="${styles.mark}"${on ? " data-on" : ""}></span>`
          return `<div class="${styles.bar}" style="--i:${i};--ready:${ready / top};--planned:${planned / top}"${i === 0 ? " data-own" : ""}><span>${r[0] ?? ""}</span><span class="${styles.track}"><i></i><b>${ready}</b></span>${mark(has(r[3]))}${mark(has(r[4]))}${mark(has(r[5]))}</div>`
        })
        .join("")}</div>`
    : ""
  // each library's row is the target of its chip
  const anchored = table.replace(
    /<tr>(\s*<td>)([\s\S]*?)<\/td>/g,
    (_, open: string, name: string) =>
      `<tr id="lib-${slug(name.replace(/<[^>]+>/g, ""))}">${open}${name}</td>`,
  )
  return `<header class="${styles.intro}">${lead}${chips}</header>${board}${anchored}${sections.join("")}`
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-")

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
  return `<span class="${letters.visuallyHidden}">${text}</span><span class="${letters.title}" data-letters-title="" aria-hidden="true">${words}</span>`
}
