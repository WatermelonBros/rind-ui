import hljs from "highlight.js/lib/common"
import { Marked } from "marked"
import type { ExampleCode } from "@/components/example-frame"
import data from "@/content/generated/docs.json"
import exampleData from "@/content/generated/examples.json"
import type { DocPage } from "@/scripts/content"

export const pages = data as readonly DocPage[]

export const pageBySlug = (slug: string): DocPage | undefined => pages.find((p) => p.slug === slug)

const slugs = new Set(pages.map((p) => p.slug))

/** `collapsible.md`, `../components/label.md#x` → `/docs/collapsible/`, `/docs/label/#x`. */
function docHref(href: string): string {
  // absolute (another site), in-page or one of this site's own paths (/llms.txt): as written
  if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("/")) return href
  const m = /(?:^|\/)([\w-]+)\.md(#.*)?$/.exec(href)
  if (m?.[1] && slugs.has(m[1])) return `/docs/${m[1]}/${m[2] ?? ""}`
  return `https://github.com/WatermelonBros/rind-ui/blob/main/docs/${href.replace(/^(\.\.\/)+/, "")}`
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext"
      const html = hljs.highlight(text, { language }).value
      // every block has its copy button (components/code-copy.tsx handles them all)
      return `<div class="code-block"><pre data-lang="${language}" tabindex="0" aria-label="${language} code"><code class="hljs">${html}</code></pre><button type="button" class="code-copy" data-code-copy>Copy</button></div>`
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const t = title ? ` title="${title}"` : ""
      return `<a href="${docHref(href)}"${t}>${text}</a>`
    },
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens)
      const id = text
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
        .replace(/[^\w]+/g, "-")
        .replace(/^-|-$/g, "")
      return `<h${depth} id="${id}">${text}</h${depth}>`
    },
  },
})

/**
 * Wide tables scroll inside a focusable box named after the section it sits in.
 */
/**
 * A props table led by a Part column repeats the part on every row and left the description
 * squeezed out of view: the part becomes a heading row over its props instead.
 */
function byPart(table: string, order: readonly string[]): string {
  if (!/<th>Part<\/th>\s*<th>Prop<\/th>/.test(table)) return table
  const columns = (table.match(/<th>/g) ?? []).length - 1
  const [head = "", body = ""] = table.split(/<tbody>/)
  // the rows of each part together, the parts in the order the anatomy lists them (Root first)
  const groups = new Map<string, string[]>()
  for (const m of body.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*([\s\S]*?)<\/tr>/g)) {
    const part = m[1] ?? ""
    groups.set(part, [...(groups.get(part) ?? []), `<tr>${m[2] ?? ""}</tr>`])
  }
  const rank = (part: string) => {
    const at = order.indexOf(part)
    return at < 0 ? order.length : at
  }
  const rows = [...groups]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(
      ([part, cells]) =>
        `<tr class="part-row" id="${partId(part)}"><th colspan="${columns}" scope="colgroup">${part}</th></tr>${cells.join("")}`,
    )
    .join("")
  return `${head.replace(/<th>Part<\/th>\s*/, "")}<tbody>${rows}</tbody></table>`
}

/** The anchor of a part's rows in the props table (the header's part chips link to it). */
export function partId(part: string): string {
  return `part-${part
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`
}

/** The parts in the order the page's anatomy table lists them. */
function anatomy(html: string): string[] {
  const table = /<table>\s*<thead>\s*<tr>\s*<th>Part<\/th>\s*<th>(?!Prop)[\s\S]*?<\/table>/.exec(
    html,
  )
  return [...(table?.[0] ?? "").matchAll(/<tr>\s*<td[^>]*>([\s\S]*?)<\/td>/g)].map(
    (m) => m[1] ?? "",
  )
}

function tables(html: string): string {
  let heading = "Table"
  const used = new Map<string, number>()
  return html
    .replace(/<h[23] id="[^"]*">(.*?)<\/h[23]>|<table>/g, (match, text: string | undefined) => {
      if (text !== undefined) {
        heading = text.replace(/<[^>]+>/g, "")
        return match
      }
      const n = (used.get(heading) ?? 0) + 1
      used.set(heading, n)
      const label = n > 1 ? `${heading} table ${n}` : `${heading} table`
      return `<div class="table-scroll" tabindex="0" role="region" aria-label="${label}"><table>`
    })
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<table>([\s\S]*?)<\/table>/g, (whole: string) => byPart(whole, anatomy(html)))
    .replace(/<table>([\s\S]*?)<\/table>/g, (table, body: string) => {
      // each cell carries its column's name, so a phone can show a row as a labelled card
      const names = [...body.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) =>
        (m[1] ?? "").replace(/<[^>]+>/g, "").replace(/"/g, "&quot;"),
      )
      if (!names.length) return table
      return table.replace(/<tr>([\s\S]*?)<\/tr>/g, (_row, cells: string) => {
        let i = 0
        const labelled = cells.replace(/<td(?=[ >])/g, () => `<td data-label="${names[i++] ?? ""}"`)
        // a long type breaks before its type arguments, not in the middle of a name, and a
        // function's arrow stays with what it returns
        return `<tr>${labelled.replace(/(<td data-label="Type">[\s\S]*?<\/td>)/g, (cell: string) =>
          cell
            .replace(/(?<=\w)&lt;/g, "<wbr>&lt;")
            .replace(/ =&gt; /g, "&nbsp;=&gt;&nbsp;")
            // a destructured argument reads as one piece: "{ reason }" never splits
            .replace(/\{ [^{}]* \}/g, (group: string) => group.replace(/ /g, "&nbsp;")),
        )}</tr>`
      })
    })
}

/**
 * The site never names other libraries (user rule). The repo docs keep their migration notes
 * and issue references for readers of the source; here a "Migrating from …" / "Coming from …"
 * section is dropped up to the next h2, and so is a parenthesised issue reference of another
 * project, such as "(radix#938)" or "(chakra-ui#5343, #4347)". The site audit fails on any
 * name left in the running text, which has to be reworded in the doc itself.
 */
export function withoutOtherLibraries(markdown: string): string {
  return (
    markdown
      .replace(/^## (?:Migrating|Coming) from [^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/gm, "")
      .replace(/ ?\((?:[\w.-]+)?#\d+(?:, ?(?:[\w.-]+)?#\d+)*\)/g, "")
      // the same reference at the end of a longer parenthesis: "(never dangling, radix#1703)"
      .replace(/[,;] ?[\w.-]+#\d+(?:, ?(?:[\w.-]+)?#\d+)*(?=\))/g, "")
  )
}

export interface Rendered {
  /** the first paragraph, shown under the live example */
  readonly intro: string
  readonly html: string
  /** the component's parts, in its anatomy's order (empty for a guide) */
  readonly parts: readonly string[]
  readonly toc: readonly {
    readonly id: string
    readonly text: string
    /** the heading's leading code span (a prop or part name), kept as code in the outline */
    readonly code?: string
  }[]
}

/**
 * Markdown → HTML without the page's own `# Title` (the layout renders it), split into the
 * intro paragraph and the rest, plus the h2 outline. On a page with a live example the first
 * code block is dropped: the example's "Get code" shows it.
 */
export function render(page: DocPage, { hasExample = false } = {}): Rendered {
  const body = withoutOtherLibraries(
    page.markdown.replace(/^# .+\n/, "").replace(/<!--[\s\S]*?-->/g, ""),
  ).trim()
  const [first = "", ...rest] = body.split(/\n\s*\n/)
  let remainder = rest.join("\n\n")
  if (hasExample) remainder = remainder.replace(/^```[\s\S]*?\n```\s*/, "")
  const intro = tables(marked.parse(first, { async: false }))
  const html = tables(marked.parse(remainder, { async: false }))
  // plain text for React, which escapes it again: tags dropped, marked's entities decoded
  const plain = (h: string) =>
    h
      .replace(/<[^>]+>/g, "")
      .replace(/&(lt|gt|quot|#39|amp);/g, (_, e: string) =>
        e === "lt" ? "<" : e === "gt" ? ">" : e === "quot" ? '"' : e === "#39" ? "'" : "&",
      )
  const toc = [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => {
    const heading = m[2] ?? ""
    const code = /^<code>(.*?)<\/code>/.exec(heading)?.[1]
    return {
      id: m[1] ?? "",
      text: plain(heading),
      ...(code === undefined ? {} : { code: plain(code) }),
    }
  })
  // the parts' names only (an anatomy row can be a note such as "(inside Content)"), once each
  const parts = [
    ...new Set(
      anatomy(html)
        .map((p) => p.replace(/<[^>]+>/g, "").trim())
        .filter((p) => /^[A-Z][\w]*(\.[A-Z][\w]*)*$/.test(p)),
    ),
  ]
  return { intro, html, toc, parts }
}

const highlight = (raw: string, language: string) => ({
  raw,
  html: hljs.highlight(raw, { language }).value,
})

/** A component's example sources, highlighted at build time. */
export function exampleCode(slug: string): ExampleCode | undefined {
  const entry = (
    exampleData as Record<
      string,
      {
        code: Record<string, string>
        css: string
        vue?: Record<string, string>
        svelte?: Record<string, string>
      }
    >
  )[slug]
  if (!entry) return undefined
  // a single-file component reads best as HTML (its template, script and style blocks)
  const each = (code: Record<string, string> | undefined, lang: string) =>
    Object.fromEntries(
      Object.entries(code ?? {}).map(([name, raw]) => [name, highlight(raw, lang)]),
    )
  return {
    code: each(entry.code, "tsx"),
    vue: each(entry.vue, "xml"),
    svelte: each(entry.svelte, "xml"),
    css: highlight(entry.css, "css"),
  }
}
