// Builds the docs content the site renders: every component and guide page from docs/, with
// the generated API tables filled in from each component's `<scope>.meta.ts` (the same
// renderer as scripts/docs-gen.ts, so the site and llms.txt cannot drift), plus llms.txt and
// the token reference (tokens.md), which are generated here and not committed.
// Run: node scripts/content.ts → content/generated/{docs.json,llms.txt,tokens.md,…}

import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import ts from "typescript"
import { apiMetas, llms, renderApi } from "../../../scripts/docs-gen.ts"
// @ts-expect-error plain .mjs script, no types
import { renderTokens } from "../../../scripts/theme-docs.mjs"
import { frameworks } from "../lib/frameworks.ts"

const repo = join(import.meta.dirname, "../../..")
const out = join(import.meta.dirname, "../content/generated")

export interface DocPage {
  readonly slug: string
  readonly section: "start" | "components" | "guides"
  readonly title: string
  readonly summary: string
  readonly markdown: string
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

// The same metas as the docs pages: the meta file plus every prop read from the types.
const { metas } = await apiMetas()
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

/** Text that holds only before or only after 1.0, chosen by the version npm serves at build
 *  time: `<!-- pre-1.0 -->…<!-- /pre-1.0 -->` and `<!-- 1.0+ -->…<!-- /1.0+ -->`. */
const stable = Number.parseInt(release.version, 10) >= 1
const byRelease = (md: string) =>
  md.replace(
    /<!-- (pre-1\.0|1\.0\+) -->([\s\S]*?)<!-- \/\1 -->\n?/g,
    (_, when: string, body: string) => ((when === "1.0+") === stable ? body : ""),
  )

// The frameworks as the packages say (lib/frameworks.ts): {{frameworks}} is their table and
// {{install}} the install command of each released one, so neither is ever out of step.
const fws = frameworks()
const frameworksTable = [
  "| Framework | Package | Status |",
  "|---|---|---|",
  ...fws.map(
    (f) =>
      `| ${f.name} | \`${f.pkg}\` | ${
        f.ready
          ? "Available"
          : f.components.length
            ? `In progress (${f.components.length} component${f.components.length > 1 ? "s" : ""})`
            : "Planned"
      } |`,
  ),
].join("\n")
const installBlocks = fws
  .filter((f) => f.ready)
  .map(
    (f, i, all) => `${all.length > 1 ? `${f.name}:\n\n` : ""}\`\`\`sh\npnpm add ${f.pkg}\n\`\`\``,
  )
  .join("\n\n")

// Site-owned pages (get started…) live with the site, not in the repo's docs/.
const sitePages = join(import.meta.dirname, "../content/pages")
const pages: DocPage[] = [
  ...readdirSync(sitePages)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      // {{version}} in a site page: the released minor (0.2); ReleaseSync refreshes it from npm
      const md = byRelease(readFileSync(join(sitePages, f), "utf8"))
      const v = release.version.replace(/\.\d+$/, "")
      return page(
        f,
        "start",
        md
          .replaceAll("{{version}}", `<span data-release="minor">${v}</span>`)
          .replaceAll("{{frameworks}}", frameworksTable)
          .replaceAll("{{install}}", installBlocks),
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

// ── markdown twins: each docs page as plain markdown at /docs/<slug>.md, and every page in
// one /llms-full.txt, for agents that read markdown. Served from public/, never committed. ──
const site = "https://rind.watermelon-studio.it"
const raw = "https://raw.githubusercontent.com/WatermelonBros/rind-ui/main/docs"
/** Site-only markup out, links resolved: every docs page sits flat under /docs/. */
const plain = (md: string) =>
  md
    .replace(/<span data-release="minor">([^<]*)<\/span>/g, "$1")
    .replace(/\]\(\.\.\/(?:components|guides)\/([\w-]+)\.md/g, "]($1.md")
    .replace(/\]\(\.\.\/theme\/([\w-]+\.md)/g, `](${raw}/theme/$1`)
const twins = join(import.meta.dirname, "../public/docs")
rmSync(twins, { recursive: true, force: true })
mkdirSync(twins, { recursive: true })
for (const p of pages) writeFileSync(join(twins, `${p.slug}.md`), plain(p.markdown))
writeFileSync(
  join(import.meta.dirname, "../public/llms-full.txt"),
  [
    "# rind-ui: the full documentation\n\n> Headless React components: behaviour, accessibility and state, styled through data-* attributes. Every component ships a test driver for Testing Library and Playwright.\n",
    ...pages.map((p) => `<!-- ${site}/docs/${p.slug}/ -->\n\n${plain(p.markdown).trim()}\n`),
  ].join("\n---\n\n"),
)

// ── llms.txt and the token reference: build outputs, never committed ──────────────────────
// The token manifest is generated first: the tokens page and the reference both read it.
execFileSync("node", [join(repo, "packages/theme/scripts/token-manifest.mjs")], {
  stdio: "inherit",
})
const tokens: string = renderTokens(
  JSON.parse(readFileSync(join(repo, "packages/theme/tokens.manifest.json"), "utf8")),
)
writeFileSync(join(out, "tokens.md"), tokens)
writeFileSync(join(out, "llms.txt"), llms(tokens))

// ── examples: each exported function's source is its code sample ──────────────────────────
const examplesDir = join(import.meta.dirname, "../examples")
const skinsDir = join(import.meta.dirname, "../skins")

/** The guides' AttributeReadout is a site helper around the example: not part of its code. */
function withoutReadout(text: string): string {
  const lines: string[] = []
  let inside = false
  for (const line of text.split("\n")) {
    if (/<AttributeReadout>/.test(line)) inside = true
    else if (/<\/AttributeReadout>/.test(line)) inside = false
    else lines.push(inside ? line.replace(/^ {2}/, "") : line)
  }
  return lines.join("\n")
}

/** Names a node reads (not property keys, member names or JSX attribute names). */
function references(node: ts.Node, names: ReadonlySet<string>): Set<string> {
  const found = new Set<string>()
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && names.has(n.text)) {
      const p = n.parent
      const key =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isQualifiedName(p) && p.right === n) ||
        ((ts.isPropertyAssignment(p) ||
          ts.isPropertySignature(p) ||
          ts.isPropertyDeclaration(p) ||
          ts.isMethodDeclaration(p) ||
          ts.isMethodSignature(p) ||
          ts.isJsxAttribute(p)) &&
          p.name === n) ||
        (ts.isBindingElement(p) && p.propertyName === n)
      if (!key) found.add(n.text)
    }
    n.forEachChild(visit)
  }
  visit(node)
  return found
}

/**
 * Each exported `function Name()` with what it needs to run as is: the imports it uses and
 * every module-level declaration it references, transitively, in source order. Site-only
 * imports (relative paths) are never shown; the guard below fails on any name left undefined.
 */
function exampleSources(file: string, source: string): Record<string, string> {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imported = new Map<
    string,
    { module: string; text: string; kind: "named" | "default" | "ns" }
  >()
  const declared = new Map<string, ts.Statement>()
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.importClause) {
      const module = s.moduleSpecifier.text
      const clause = s.importClause
      const typeOnly = clause.isTypeOnly ? "type " : ""
      if (clause.name)
        imported.set(clause.name.text, { module, text: clause.name.text, kind: "default" })
      const b = clause.namedBindings
      if (b && ts.isNamespaceImport(b))
        imported.set(b.name.text, { module, text: b.name.text, kind: "ns" })
      if (b && ts.isNamedImports(b))
        for (const e of b.elements)
          imported.set(e.name.text, { module, text: typeOnly + e.getText(), kind: "named" })
      continue
    }
    const names: string[] = []
    if (
      (ts.isFunctionDeclaration(s) ||
        ts.isClassDeclaration(s) ||
        ts.isInterfaceDeclaration(s) ||
        ts.isTypeAliasDeclaration(s) ||
        ts.isEnumDeclaration(s)) &&
      s.name
    )
      names.push(s.name.text)
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations)
        if (ts.isIdentifier(d.name)) names.push(d.name.text)
    for (const n of names) declared.set(n, s)
  }
  const all = new Set([...imported.keys(), ...declared.keys()])
  const isExported = (s: ts.Statement) =>
    ts.canHaveModifiers(s) &&
    !!ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  const out: Record<string, string> = {}
  for (const main of sf.statements) {
    if (
      !ts.isFunctionDeclaration(main) ||
      !main.name ||
      !isExported(main) ||
      main.parameters.length
    )
      continue
    const keep = new Set<ts.Statement>([main])
    const used = new Set<string>()
    const queue: ts.Statement[] = [main]
    for (let s = queue.pop(); s; s = queue.pop()) {
      for (const n of references(s, all)) {
        if (n === "AttributeReadout") continue
        used.add(n)
        const d = declared.get(n)
        if (d && !keep.has(d)) {
          keep.add(d)
          queue.push(d)
        }
      }
    }
    const modules = new Map<string, { named: string[]; head: string[] }>()
    for (const [name, i] of imported) {
      if (!used.has(name) || /^\.\.?\//.test(i.module)) continue
      const m = modules.get(i.module) ?? { named: [], head: [] }
      if (i.kind === "named") m.named.push(i.text)
      else m.head.push(i.kind === "ns" ? `* as ${i.text}` : i.text)
      modules.set(i.module, m)
    }
    const imports = [...modules].map(([module, m]) => {
      const parts = [...m.head, ...(m.named.length ? [`{ ${m.named.join(", ")} }`] : [])]
      return `import ${parts.join(", ")} from "${module}"`
    })
    const body = sf.statements
      .filter((s) => keep.has(s))
      .map((s) => {
        // a helper keeps its comment; lint suppressions are the site's own
        const comments = s === main ? "" : source.slice(s.getFullStart(), s.getStart()).trim()
        const text = s === main ? s.getText() : s.getText().replace(/^export /, "")
        return withoutReadout(
          [comments.replace(/^\s*\/\/ biome-ignore.*$\n?/gm, "").trim(), text]
            .filter(Boolean)
            .join("\n"),
        )
      })
    out[main.name.text] = `${imports.join("\n")}\n\n${body.join("\n\n")}\n`
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
    code: exampleSources(f, readFileSync(join(examplesDir, f), "utf8")),
    css: skinCss(slug),
  }
}
// Guard: copied code runs as is. Every name a shown snippet reads must be defined or imported
// in it. Imports are not resolved (the packages may not be built yet): only free names count.
{
  const snippets = new Map<string, string>()
  for (const [slug, { code }] of Object.entries(examples))
    for (const [name, text] of Object.entries(code))
      snippets.set(join(examplesDir, "__shown__", slug, `${name}.tsx`), text)
  const options: ts.CompilerOptions = {
    noResolve: true,
    types: ["react"],
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    noEmit: true,
  }
  const host = ts.createCompilerHost(options)
  const read = host.getSourceFile.bind(host)
  host.getSourceFile = (file, lang, ...rest) => {
    const text = snippets.get(file)
    return text === undefined ? read(file, lang, ...rest) : ts.createSourceFile(file, text, lang)
  }
  const program = ts.createProgram([...snippets.keys()], options, host)
  // cannot find name / namespace, did you mean, shorthand property with no value in scope
  const free = new Set([2304, 2503, 2552, 18004])
  const problems = [...snippets.keys()].flatMap((file) =>
    program
      .getSemanticDiagnostics(program.getSourceFile(file))
      .filter((d) => free.has(d.code))
      .map(
        (d) =>
          `examples/${file.split("__shown__/")[1]}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`,
      ),
  )
  if (problems.length)
    throw new Error(`shown example code is not self-contained:\n${problems.join("\n")}`)
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
      // its Get code panel shows this source: an example the extractor missed has none
      if (dir === examplesDir && !examples[slug]?.code[name]?.includes(`function ${name}(`)) {
        throw new Error(`examples/${f}: variant ${name} has no extracted source`)
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

// ── compare: content/compare.md with its coverage table filled in, for /compare and its
// markdown twin /compare.md. The other libraries' counts come from docs/components.md's
// "Coverage per library" table; rind-ui's from the roadmap above, so it is always current. ──
const coverage: string[] = []
let inCoverage = false
for (const line of readFileSync(join(repo, "docs/components.md"), "utf8").split("\n")) {
  if (line.startsWith("## ")) inCoverage = line.startsWith("## Coverage per library")
  if (!inCoverage || !line.startsWith("| ") || line.startsWith("| Library")) continue
  const [name, count, frameworks] = line
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim())
  if (!name || !count || !frameworks) continue
  // Ark is built on state machines (Zag.js); React Aria publishes testers for some components
  const machines = name.startsWith("Ark") ? "yes (Zag.js)" : "no"
  const drivers = name.startsWith("React Aria") ? "some components" : "no"
  coverage.push(`| ${name} | ${count} | ${frameworks} | ${drivers} | ${machines} | none |`)
}
const ready = roadmap.filter((r) => r.status === "done")
const aiReady = ready.filter((r) => r.wave === "AI").length
const coverageTable = [
  "| Library | Components | Frameworks | Test drivers | State machines | AI-UI primitives |",
  "|---|---|---|---|---|---|",
  `| **rind-ui** | ${ready.length} ready, ${roadmap.length - ready.length} planned | React (framework-free core) | every component | declared, with model-based tests | ${aiReady} ready |`,
  ...coverage,
].join("\n")
// the gaps, from the repository's own list (docs/compare-gaps.md), so the page shows the same
// table the maintainers keep; its links point inside the repository, so they become plain text
const gapsTable = readFileSync(join(repo, "docs/compare-gaps.md"), "utf8")
  .split("\n")
  .filter((line) => line.startsWith("|"))
  .map((line) => line.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`([^`]+)` rows/, "$1 rows"))
  .join("\n")
const compare = byRelease(readFileSync(join(import.meta.dirname, "../content/compare.md"), "utf8"))
  .replace("<!-- coverage -->", coverageTable)
  .replace("<!-- gaps -->", gapsTable)
writeFileSync(join(out, "compare.md"), compare)
writeFileSync(join(import.meta.dirname, "../public/compare.md"), compare)
