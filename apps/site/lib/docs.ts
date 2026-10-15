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
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return href
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
      return `<pre data-lang="${language}" tabindex="0" aria-label="${language} code"><code class="hljs">${html}</code></pre>`
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
}

export interface Rendered {
  /** the first paragraph, shown under the live example */
  readonly intro: string
  readonly html: string
  readonly toc: readonly { readonly id: string; readonly text: string }[]
}

/**
 * Markdown → HTML without the page's own `# Title` (the layout renders it), split into the
 * intro paragraph and the rest, plus the h2 outline. On a page with a live example the first
 * code block is dropped: the example's "Get code" shows it.
 */
export function render(page: DocPage, { hasExample = false } = {}): Rendered {
  const body = page.markdown
    .replace(/^# .+\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim()
  const [first = "", ...rest] = body.split(/\n\s*\n/)
  let remainder = rest.join("\n\n")
  if (hasExample) remainder = remainder.replace(/^```[\s\S]*?\n```\s*/, "")
  const intro = tables(marked.parse(first, { async: false }))
  const html = tables(marked.parse(remainder, { async: false }))
  const toc = [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => ({
    id: m[1] ?? "",
    text: (m[2] ?? "").replace(/<[^>]+>/g, ""),
  }))
  return { intro, html, toc }
}

const highlight = (raw: string, language: string) => ({
  raw,
  html: hljs.highlight(raw, { language }).value,
})

/** A component's example sources, highlighted at build time. */
export function exampleCode(slug: string): ExampleCode | undefined {
  const entry = (exampleData as Record<string, { code: Record<string, string>; css: string }>)[slug]
  if (!entry) return undefined
  return {
    code: Object.fromEntries(
      Object.entries(entry.code).map(([name, raw]) => [name, highlight(raw, "tsx")]),
    ),
    css: highlight(entry.css, "css"),
  }
}
