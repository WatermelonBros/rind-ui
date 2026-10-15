// Builds the docs content the site renders: every component and guide page from docs/, with
// the generated API tables filled in from each component's `<scope>.meta.ts` (the same
// renderer as scripts/docs-gen.ts, so the site and llms.txt cannot drift).
// Run: node scripts/content.ts → content/generated/docs.json
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import type { ComponentMeta } from "../../../packages/core/src/components/meta.ts"
import { renderApi } from "../../../scripts/docs-gen.ts"

const repo = join(import.meta.dirname, "../../..")
const out = join(import.meta.dirname, "../content/generated")

export interface DocPage {
  readonly slug: string
  readonly section: "components" | "guides"
  readonly title: string
  readonly summary: string
  readonly markdown: string
}

async function loadMetas(): Promise<Map<string, ComponentMeta>> {
  const dir = join(repo, "packages/core/src/components")
  const metas = new Map<string, ComponentMeta>()
  for (const scope of readdirSync(dir)) {
    const file = join(dir, scope, `${scope}.meta.ts`)
    if (!existsSync(file)) continue
    const mod = (await import(file)) as Record<string, ComponentMeta>
    const meta = Object.values(mod).find((v) => v.scope === scope)
    if (meta) metas.set(scope, meta)
  }
  return metas
}

const markdownFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(dir, f))

function page(file: string, section: DocPage["section"], markdown: string): DocPage {
  const title = /^# (.+)$/m.exec(markdown)?.[1] ?? basename(file, ".md")
  const summary =
    markdown
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#") && !p.startsWith("<!--") && !p.startsWith("```"))
      ?.replace(/\s+/g, " ") ?? ""
  return { slug: basename(file, ".md"), section, title, summary, markdown }
}

const metas = await loadMetas()
// An api block is `<!-- api:scope -->`, optionally already filled up to `<!-- /api -->`.
const fillApi = (md: string) =>
  md.replace(/<!-- api:([\w-]+) -->(?:[\s\S]*?<!-- \/api -->)?/g, (whole, scope: string) => {
    const meta = metas.get(scope)
    return meta ? renderApi(meta) : whole
  })

const pages: DocPage[] = [
  ...markdownFiles(join(repo, "docs/components")).map((f) =>
    page(f, "components", fillApi(readFileSync(f, "utf8"))),
  ),
  ...markdownFiles(join(repo, "docs/guides")).map((f) =>
    page(f, "guides", readFileSync(f, "utf8")),
  ),
]

mkdirSync(out, { recursive: true })
writeFileSync(join(out, "docs.json"), `${JSON.stringify(pages, null, 2)}\n`)
console.log(`content: ${pages.length} pages`)
