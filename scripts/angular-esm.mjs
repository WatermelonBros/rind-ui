// ngc keeps the source's extensionless relative imports (`from "../bind-props"`), which a
// bundler resolves but Node's ESM loader does not: a consumer's SSR or a test runner that leaves
// the package external would fail with ERR_MODULE_NOT_FOUND. Run after `ngc` from the package
// directory: it writes each relative specifier in dist as the file Node loads, and fails the
// build if one points at nothing.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

const specifier = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g
const missing = []

for (const file of readdirSync("dist", { recursive: true, encoding: "utf8" })) {
  if (!/\.(js|d\.ts)$/.test(file)) continue
  const path = join("dist", file)
  const source = readFileSync(path, "utf8")
  const output = source.replace(specifier, (match, keyword, quote, spec) => {
    if (/\.(m?js|json)$/.test(spec)) return match
    const target = join(dirname(path), spec)
    const resolved = existsSync(`${target}.js`)
      ? `${spec}.js`
      : existsSync(target) && statSync(target).isDirectory() && existsSync(join(target, "index.js"))
        ? `${spec.replace(/\/$/, "")}/index.js`
        : null
    if (resolved === null) {
      missing.push(`${path}: ${spec}`)
      return match
    }
    return `${keyword}${quote}${resolved}${quote}`
  })
  if (output !== source) writeFileSync(path, output)
}

if (missing.length > 0) {
  console.error(`Relative imports in dist that resolve to no file:\n${missing.join("\n")}`)
  process.exit(1)
}

// The proof is Node loading the root entry, which imports every component. A partially compiled
// library needs the JIT compiler when nothing has linked it, as in a consumer's Node test run.
const require = createRequire(join(process.cwd(), "package.json"))
await import(pathToFileURL(require.resolve("@angular/compiler")).href)
await import(pathToFileURL("dist/index.js").href)
