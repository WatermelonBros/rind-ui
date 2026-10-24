// @rind-ui/svelte's `exports`, one entry per component (`@rind-ui/svelte/<component>`), as
// tsdown writes them for the React and Vue packages. Run after `svelte-package` from the
// package directory, which also drops the tests svelte-package copied. The site reads these entries to know which components Svelte ships.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

// svelte-package copies every source file; tests are not part of the package.
for (const file of readdirSync("dist", { recursive: true, encoding: "utf8" })) {
  if (/\.test(-d)?\.(js|d\.ts)$/.test(file)) rmSync(`dist/${file}`)
}

const components = readdirSync("src", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`src/${entry.name}/index.ts`))
  .map((entry) => entry.name)
  .sort()

const entry = (dir, source) => ({
  ...(source ? { "@rind-ui/source": `./src/${dir}index.ts` } : {}),
  types: `./dist/${dir}index.d.ts`,
  svelte: `./dist/${dir}index.js`,
  default: `./dist/${dir}index.js`,
})
const exportsFor = (source) => ({
  ".": entry("", source),
  ...Object.fromEntries(components.map((name) => [`./${name}`, entry(`${name}/`, source)])),
  "./package.json": "./package.json",
})

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
pkg.exports = exportsFor(true)
pkg.publishConfig = { ...pkg.publishConfig, exports: exportsFor(false) }
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`)
