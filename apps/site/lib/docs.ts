import hljs from "highlight.js/lib/common"
import { Marked } from "marked"
import data from "@/content/generated/docs.json"
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
      return `<pre data-lang="${language}"><code class="hljs">${html}</code></pre>`
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

export interface Rendered {
  readonly html: string
  readonly toc: readonly { readonly id: string; readonly text: string }[]
}

/** Markdown → HTML without the page's own `# Title` (the layout renders it), plus its h2 outline. */
export function render(page: DocPage): Rendered {
  const body = page.markdown.replace(/^# .+\n/, "").replace(/<!--[\s\S]*?-->/g, "")
  const html = marked.parse(body, { async: false })
  const toc = [...html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map((m) => ({
    id: m[1] ?? "",
    text: (m[2] ?? "").replace(/<[^>]+>/g, ""),
  }))
  return { html, toc }
}
