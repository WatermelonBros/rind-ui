// Per-component bundle budgets for @rind-ui/react: what a consumer downloads when it imports
// one component. Each public component is bundled the way an app bundler would (esbuild,
// minified, production, React external), once from the package root and once from its
// subpath, and the gzipped size is checked against size-budgets.json (every subpath needs
// one). Runs after the react build (packages/react `build`); needs both packages built.
// `node scripts/size.mjs --report` prints the sizes without failing.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { build } from "esbuild"
import { quirkMeta } from "../packages/core/src/dom/quirk-meta.ts"

const reactDir = new URL("../packages/react/", import.meta.url).pathname
const report = process.argv.includes("--report")
const budgets = JSON.parse(readFileSync(new URL("size-budgets.json", import.meta.url), "utf8"))

// Quirk metadata is tooling-only (openspec bundle-size): no component bundle may contain a
// repro test path or a removal condition from the registry.
const quirkMarkers = Object.values(quirkMeta).flatMap((m) => [m.test, m.removeWhen])
const carriesQuirkMeta = (text) => quirkMarkers.some((marker) => text.includes(marker))

const pascal = (slug) => slug.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())

async function measure(contents) {
  const result = await build({
    stdin: { contents, resolveDir: reactDir, loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    external: ["react", "react/*", "react-dom", "react-dom/*"],
    define: { "process.env.NODE_ENV": '"production"' },
    write: false,
    metafile: true,
    logLevel: "silent",
  })
  const file = result.outputFiles[0]
  const code = file?.contents ?? new Uint8Array()
  return {
    min: code.length,
    gz: gzipSync(code, { level: 9 }).length,
    quirkMeta: carriesQuirkMeta(file?.text ?? ""),
    text: file?.text ?? "",
    // Modules with code in the output (the metafile's inputs also list tree-shaken ones).
    modules: Object.values(result.metafile.outputs).flatMap((out) =>
      Object.entries(out.inputs)
        .filter(([, input]) => input.bytesInOutput > 0)
        .map(([path]) => path),
    ),
  }
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`

const pkg = JSON.parse(readFileSync(`${reactDir}package.json`, "utf8"))
const components = readdirSync(`${reactDir}src`)
  .filter((name) => statSync(`${reactDir}src/${name}`).isDirectory())
  .filter((name) => pkg.exports[`./${name}`])
  .sort()

const all = await measure(`import * as R from "@rind-ui/react"; console.log(R)`)
console.log(`everything: ${kb(all.min)} min, ${kb(all.gz)} gzip`)

const failures = []
// Development diagnostics are guarded by process.env.NODE_ENV and dropped in production
// (openspec bundle-size). Only runtime failure reports stay: a consumer callback threw or
// rejected. Thrown errors are not console calls and are not checked.
const FAILURE_REPORTS = [
  "tour: the effect of step", // a step's effect threw or rejected
  "tour: the cleanup of step", // a step effect's cleanup threw
]
const diagnostics = [
  ...all.text.matchAll(/console\.(?:warn|error)\(\s*[`"']\[rind-ui\] ([^`"'$]*)/g),
]
  .map((m) => m[1] ?? "")
  .filter((message) => !FAILURE_REPORTS.some((report) => message.startsWith(report)))
for (const message of diagnostics) {
  failures.push(`production bundle keeps a development diagnostic: [rind-ui] ${message}`)
}
for (const slug of components) {
  const name = budgets.names?.[slug] ?? pascal(slug)
  const root = await measure(`import { ${name} } from "@rind-ui/react"; console.log(${name})`)
  const sub = await measure(
    `import { ${name} } from "@rind-ui/react/${slug}"; console.log(${name})`,
  )
  if (root.quirkMeta || sub.quirkMeta) failures.push(`${name}: bundle contains quirk metadata`)
  if (budgets.components[slug] === undefined) {
    failures.push(`${name}: no budget in scripts/size-budgets.json`)
    continue
  }
  const budget = budgets.components[slug] * 1024
  const worst = Math.max(root.gz, sub.gz)
  const over = worst > budget
  console.log(
    `${over ? "✗" : " "} ${name.padEnd(22)} root ${kb(root.gz).padStart(9)}  subpath ${kb(sub.gz).padStart(9)}  budget ${kb(budget)}`,
  )
  if (over) failures.push(`${name}: ${kb(worst)} gzip, budget ${kb(budget)}`)
}

// On-demand capabilities ship only with the components that request them (openspec
// bundle-size): Switch requests none, Clipboard requests the clipboard and the announcer.
// Constraint validity is not listed: its helpers also serve every hidden form input.
const ON_DEMAND = ["live-announcer", "clipboard", "collection-layout"]
const carries = (m, name) => m.modules.some((path) => path.endsWith(`/dom/${name}.mjs`))
const plain = await measure(`import { Switch } from "@rind-ui/react/switch"; console.log(Switch)`)
const leaked = ON_DEMAND.filter((name) => carries(plain, name))
if (leaked.length > 0) failures.push(`Switch carries on-demand capabilities: ${leaked.join(", ")}`)
// Long press ships only with the parts that opt in (Context Menu), not with every pressable.
if (carries(plain, "long-press")) failures.push("Switch carries the long-press module")
const menu = await measure(`import { ContextMenu } from "@rind-ui/react"; console.log(ContextMenu)`)
if (!carries(menu, "long-press")) failures.push("ContextMenu does not carry the long-press module")
const copy = await measure(
  `import { Clipboard } from "@rind-ui/react/clipboard"; console.log(Clipboard)`,
)
if (!carries(copy, "clipboard")) failures.push("Clipboard does not carry the clipboard capability")

const button = await measure(`import { Button } from "@rind-ui/react"; console.log(Button)`)
const ratio = button.gz / all.gz
console.log(`Button / everything: ${(ratio * 100).toFixed(1)}% (limit 10%)`)
if (ratio > 0.1) failures.push(`Button is ${(ratio * 100).toFixed(1)}% of the whole library`)

if (failures.length > 0 && !report) {
  console.error(`\nover budget:\n  ${failures.join("\n  ")}`)
  process.exit(1)
}
