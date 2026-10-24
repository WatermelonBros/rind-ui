// Per-component bundle budgets for @rind-ui/vue and @rind-ui/svelte (vue-svelte-adapters
// 1.7b): what a consumer downloads when it imports one component from its subpath. Each is
// bundled the way Vite would in production (Rolldown, minified; the framework external, core
// bundled; `.svelte` compiled for the client), gzipped and checked against
// size-budgets-adapters.json (every subpath needs one). Runs after the package's build.
// `node scripts/size-adapters.mjs <vue|svelte> --report` prints the sizes without failing.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { gzipSync } from "node:zlib"

const framework = process.argv[2]
if (framework !== "vue" && framework !== "svelte") {
  console.error("usage: node scripts/size-adapters.mjs <vue|svelte> [--report]")
  process.exit(2)
}
const report = process.argv.includes("--report")
const dir = new URL(`../packages/${framework}/`, import.meta.url).pathname
const require = createRequire(dir)
// Rolldown is core's dev dependency (as in size.mjs); the compiler is the package's own.
const { rolldown } = createRequire(new URL("../packages/core/", import.meta.url))("rolldown")
const budgets = JSON.parse(
  readFileSync(new URL("size-budgets-adapters.json", import.meta.url), "utf8"),
)[framework]
const pkg = JSON.parse(readFileSync(`${dir}package.json`, "utf8"))

const external = framework === "vue" ? [/^vue($|\/)/] : [/^svelte($|\/)/, /^esm-env/]
const plugins = [
  {
    name: "entry",
    resolveId: (id) => (id === "virtual:entry" ? id : null),
    load: (id) => (id === "virtual:entry" ? globalThis.entry : null),
  },
]
if (framework === "svelte") {
  const { compile, compileModule } = require("svelte/compiler")
  plugins.push({
    name: "svelte",
    transform(code, id) {
      if (id.endsWith(".svelte")) return compile(code, { filename: id, generate: "client" }).js.code
      if (/\.svelte\.js$/.test(id)) return compileModule(code, { filename: id }).js.code
      return null
    },
  })
}

async function measure(contents) {
  globalThis.entry = contents
  const bundle = await rolldown({
    input: "virtual:entry",
    cwd: dir,
    external,
    resolve: { conditionNames: ["svelte", "browser", "import", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    plugins,
    logLevel: "silent",
  })
  const { output } = await bundle.generate({ minify: true, format: "esm" })
  const code = output.map((chunk) => ("code" in chunk ? chunk.code : "")).join("")
  return gzipSync(code, { level: 9 }).length
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`
const pascal = (slug) => slug.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())
const slugs = Object.keys(pkg.exports)
  .filter((key) => key !== "." && !key.includes("*") && !key.endsWith(".json"))
  .map((key) => key.slice(2))
  .sort()

const failures = []
for (const slug of slugs) {
  // Every export of the subpath (a namespace, its hooks and helpers), as a consumer could use.
  const size = await measure(`import * as C from "@rind-ui/${framework}/${slug}"; console.log(C)`)
  const budget = budgets[slug]
  if (budget === undefined) {
    failures.push(`${slug}: no budget in scripts/size-budgets-adapters.json`)
    if (report) console.log(`  ${pascal(slug).padEnd(22)} ${kb(size).padStart(9)}  (no budget)`)
    continue
  }
  const over = size > budget * 1024
  console.log(
    `${over ? "✗" : " "} ${pascal(slug).padEnd(22)} ${kb(size).padStart(9)}  budget ${kb(budget * 1024)}`,
  )
  if (over) failures.push(`${slug}: ${kb(size)} gzip, budget ${kb(budget * 1024)}`)
}

if (failures.length > 0 && !report) {
  console.error(`\nover budget:\n  ${failures.join("\n  ")}`)
  process.exit(1)
}
