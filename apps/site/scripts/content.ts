// Builds the docs content the site renders: every component and guide page from docs/, with
// the generated API tables filled in from each component's `<scope>.meta.ts` (the same
// renderer as scripts/docs-gen.ts, so the site and llms.txt cannot drift).
// Run: node scripts/content.ts → content/generated/docs.json

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import type { ComponentMeta } from "../../../packages/core/src/components/meta.ts"
import { renderApi } from "../../../scripts/docs-gen.ts"

const repo = join(import.meta.dirname, "../../..")
const out = join(import.meta.dirname, "../content/generated")

export interface DocPage {
  readonly slug: string
  readonly section: "start" | "components" | "guides"
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

// Only pages committed to git: an untracked page is another session's work in progress.
const tracked = new Set(
  execFileSync("git", ["ls-files", "docs"], { cwd: repo, encoding: "utf8" }).split("\n"),
)
const markdownFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".md") && tracked.has(`${dir.slice(repo.length + 1)}/${f}`))
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

// Site-owned pages (get started…) live with the site, not in the repo's docs/.
const sitePages = join(import.meta.dirname, "../content/pages")
const pages: DocPage[] = [
  ...readdirSync(sitePages)
    .filter((f) => f.endsWith(".md"))
    .map((f) => page(f, "start", readFileSync(join(sitePages, f), "utf8"))),
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

// ── examples: each exported function's source is its code sample ──────────────────────────
const examplesDir = join(import.meta.dirname, "../examples")
const skinsDir = join(import.meta.dirname, "../skins")

/** `export function Name() {` … the first line that is exactly `}`. */
function exampleSources(source: string): Record<string, string> {
  const rind = /import \{([^}]+)\} from "@rind-ui\/react"/.exec(source)?.[1]?.split(",") ?? []
  const out: Record<string, string> = {}
  for (const m of source.matchAll(/^export function (\w+)\(\)[^\n]*\{\n[\s\S]*?\n\}$/gm)) {
    const body = m[0].replace(/^export /, "")
    const used = rind.map((s) => s.trim()).filter((n) => n && new RegExp(`\\b${n}\\b`).test(body))
    const hooks = ["useState", "useRef", "useEffect"].filter((h) =>
      new RegExp(`\\b${h}[(<]`).test(body),
    )
    const imports = [
      used.length ? `import { ${used.join(", ")} } from "@rind-ui/react"` : "",
      hooks.length ? `import { ${hooks.join(", ")} } from "react"` : "",
    ].filter(Boolean)
    out[m[1] ?? ""] = `${imports.join("\n")}\n\nexport ${body}\n`
  }
  return out
}

/** Top-level CSS blocks that style `scope`, plus the keyframes they use. */
function skinCss(scope: string): string {
  const blocks: string[] = []
  for (const f of readdirSync(skinsDir).filter((f) => f.endsWith(".css") && f !== "index.css")) {
    const css = readFileSync(join(skinsDir, f), "utf8")
    let depth = 0
    let start = 0
    for (let i = 0; i < css.length; i++) {
      if (css[i] === "{") depth++
      else if (css[i] === "}" && --depth === 0) {
        blocks.push(css.slice(start, i + 1).trim())
        start = i + 1
      }
    }
  }
  const bare = blocks.map((b) => b.replace(/^(\/\*[\s\S]*?\*\/\s*)+/, ""))
  const keep = bare.filter((b) => b.includes(`data-scope="${scope}"`))
  const frames = bare.filter(
    (b) => b.startsWith("@keyframes") && keep.some((k) => k.includes(b.split(/\s+/)[1] ?? "@")),
  )
  return [...keep, ...frames].join("\n\n")
}

const examples: Record<string, { code: Record<string, string>; css: string }> = {}
for (const f of readdirSync(examplesDir).filter((f) => f.endsWith(".tsx"))) {
  const slug = basename(f, ".tsx")
  examples[slug] = {
    code: exampleSources(readFileSync(join(examplesDir, f), "utf8")),
    css: skinCss(slug),
  }
}
writeFileSync(join(out, "examples.json"), `${JSON.stringify(examples, null, 2)}\n`)
