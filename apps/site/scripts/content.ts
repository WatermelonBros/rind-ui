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

// ── release: the version published on npm (the build also works offline: then the workspace's) ──
function publishedVersion(): { version: string; source: "npm" | "workspace" } {
  try {
    const version = execFileSync("npm", ["view", "@rind-ui/react", "version"], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    if (/^\d+\.\d+\.\d+/.test(version)) return { version, source: "npm" }
  } catch {}
  const pkg = readFileSync(
    join(import.meta.dirname, "../../../packages/react/package.json"),
    "utf8",
  )
  return { version: (JSON.parse(pkg) as { version: string }).version, source: "workspace" }
}
const release = publishedVersion()
console.log(`release: @rind-ui/react ${release.version} (${release.source})`)

// Site-owned pages (get started…) live with the site, not in the repo's docs/.
const sitePages = join(import.meta.dirname, "../content/pages")
const pages: DocPage[] = [
  ...readdirSync(sitePages)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      // {{version}} in a site page: the released minor (0.2); ReleaseSync refreshes it from npm
      const md = readFileSync(join(sitePages, f), "utf8")
      const v = release.version.replace(/\.\d+$/, "")
      return page(
        f,
        "start",
        md.replaceAll("{{version}}", `<span data-release="minor">${v}</span>`),
      )
    }),
  ...markdownFiles(join(repo, "docs/components")).map((f) =>
    page(f, "components", fillApi(readFileSync(f, "utf8"))),
  ),
  ...markdownFiles(join(repo, "docs/guides")).map((f) =>
    page(f, "guides", readFileSync(f, "utf8")),
  ),
]

mkdirSync(out, { recursive: true })
writeFileSync(join(out, "docs.json"), `${JSON.stringify(pages, null, 2)}\n`)
writeFileSync(join(out, "release.json"), `${JSON.stringify(release, null, 2)}\n`)
console.log(`content: ${pages.length} pages`)

// ── examples: each exported function's source is its code sample ──────────────────────────
const examplesDir = join(import.meta.dirname, "../examples")
const skinsDir = join(import.meta.dirname, "../skins")

/** `export function Name() {` … the first line that is exactly `}`. */
function exampleSources(source: string): Record<string, string> {
  const rind = /import \{([^}]+)\} from "@rind-ui\/react"/.exec(source)?.[1]?.split(",") ?? []
  const out: Record<string, string> = {}
  for (const m of source.matchAll(/^export function (\w+)\(\)[^\n]*\{\n[\s\S]*?\n\}$/gm)) {
    // the guides' AttributeReadout is a site helper around the example: not part of its code
    const lines: string[] = []
    let inside = false
    for (const line of m[0].replace(/^export /, "").split("\n")) {
      if (/<AttributeReadout>/.test(line)) inside = true
      else if (/<\/AttributeReadout>/.test(line)) inside = false
      else lines.push(inside ? line.replace(/^ {2}/, "") : line)
    }
    const body = lines.join("\n")
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

// ── examples harness: every example of every module, for /examples/<slug>/<example>/<skin>/ ──
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()

/** The body of a module's `export const <name> … = { … }` object literal, if any. */
function block(source: string, name: string): string {
  const at = new RegExp(`^export const ${name}\\b[^=]*= \\{`, "m").exec(source)
  if (!at) return ""
  const open = at.index + at[0].length
  let depth = 1
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}" && --depth === 0) return `\n${source.slice(open, i)}`
  }
  return ""
}

type HarnessEntry = {
  slug: string
  example: string
  name: string
  title: string
  hidden: boolean
  states: string[]
  axeDisable: string[]
  viewport?: "mobile"
  motion: "keep" | "reduce"
}
const harness: HarnessEntry[] = []
const fixturesDir = join(examplesDir, "fixtures")
for (const [dir, files] of [
  [examplesDir, readdirSync(examplesDir)],
  [fixturesDir, readdirSync(fixturesDir)],
] as const) {
  for (const f of files.filter((f) => f.endsWith(".tsx") && f !== "attribute-readout.tsx")) {
    const slug = basename(f, ".tsx")
    const source = readFileSync(join(dir, f), "utf8")
    const states = new Map<string, string[]>()
    for (const [, scope, inner] of block(source, "states").matchAll(
      /"?([\w-]+)"?\s*:\s*\{([^}]*)\}/g,
    )) {
      for (const [, state, example] of (inner ?? "").matchAll(/"?(\w+)"?\s*:\s*"(\w+)"/g)) {
        states.set(example ?? "", [...(states.get(example ?? "") ?? []), `${scope}:${state}`])
      }
    }
    const variants = block(source, "variants")
    const keys = [...variants.matchAll(/^ {2}(\w+): \{/gm)]
    keys.forEach((m, i) => {
      const name = m[1] ?? ""
      const body = variants.slice(m.index, keys[i + 1]?.index)
      if (!new RegExp(`^export function ${name}\\(\\)`, "m").test(source)) {
        throw new Error(`examples/${f}: variant ${name} has no exported function`)
      }
      if (harness.some((e) => e.slug === slug && e.name === name)) {
        throw new Error(`examples/${f}: ${name} is already an example of "${slug}"`)
      }
      harness.push({
        slug,
        example: kebab(name),
        name,
        title: /title: "([^"]*)"/.exec(body)?.[1] ?? name,
        hidden: /hidden: true/.test(body),
        states: states.get(name) ?? [],
        axeDisable: [
          ...(/axeDisable: \[([^\]]*)\]/.exec(body)?.[1] ?? "").matchAll(/"([\w-]+)"/g),
        ].map((r) => r[1] ?? ""),
        motion: /motion: "keep"/.test(body) ? "keep" : "reduce",
        ...(/viewport: "mobile"/.test(body) ? { viewport: "mobile" as const } : {}),
      })
    })
    for (const name of states.keys()) {
      if (!keys.some((k) => k[1] === name)) {
        throw new Error(`examples/${f}: state example ${name} is not in variants`)
      }
    }
  }
}
writeFileSync(join(out, "harness.json"), `${JSON.stringify(harness, null, 2)}\n`)

// ── roadmap: every planned component, its wave and status, from docs/components.md ─────────
type Status = "todo" | "research" | "spec" | "wip" | "done"
const statuses = new Set<string>(["todo", "research", "spec", "wip", "done"])
const docSlugs = new Set(pages.filter((p) => p.section === "components").map((p) => p.slug))
const roadmap: { category: string; name: string; wave: string; status: Status; slug?: string }[] =
  []
let category = ""
for (const line of readFileSync(join(repo, "docs/components.md"), "utf8").split("\n")) {
  const heading = /^## (.+?)(?: \(\d+\))?$/.exec(line)
  if (heading) {
    category = heading[1] ?? ""
    continue
  }
  if (!category || category.startsWith("Utilities") || category.startsWith("Coverage")) continue
  if (!line.startsWith("| ") || line.startsWith("| Component") || line.startsWith("|---")) continue
  const cells = line
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim())
  const at = cells.findIndex((c) => statuses.has(c))
  if (at < 0 || !cells[0]) continue
  const before = cells[at - 1] ?? ""
  const slug = cells[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  roadmap.push({
    category,
    name: cells[0],
    wave: /^\d$/.test(before) ? before : category.startsWith("AI") ? "AI" : "",
    status: cells[at] as Status,
    ...(docSlugs.has(slug) ? { slug } : {}),
  })
}
writeFileSync(join(out, "roadmap.json"), `${JSON.stringify(roadmap, null, 2)}\n`)
