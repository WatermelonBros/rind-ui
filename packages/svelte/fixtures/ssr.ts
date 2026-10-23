// Server and client builds of one fixture, for hydration tests: Vitest compiles `.svelte` for
// the DOM only, so the fixture (and the parts it imports) is bundled twice with Svelte's
// compiler. `svelte` and `@rind-ui/core` stay external, so the client bundle hydrates with the
// test's own Svelte runtime.
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { rolldown } from "rolldown"
import { transformSync } from "rolldown/utils"
import { compile, compileModule } from "svelte/compiler"

const here = dirname(fileURLToPath(import.meta.url))
// Outside node_modules, so Vite transforms the bundle and resolves its imports like the tests.
const out = join(here, "../.ssr")

// The tests run with the browser condition, where bare `svelte` is the client runtime; the
// server bundle needs the server one (what `svelte/server`'s render uses).
const svelteRoot = dirname(createRequire(import.meta.url).resolve("svelte/package.json"))
const serverIndex = join(svelteRoot, "src/index-server.js")

function sveltePlugin(generate: "server" | "client") {
  return {
    name: "rind:svelte",
    resolveId(id: string) {
      if (id !== "svelte") return null
      return generate === "server" ? { id: serverIndex, external: true } : { id, external: true }
    },
    transform(code: string, id: string) {
      if (id.endsWith(".svelte")) {
        return compile(code, { filename: id, generate, dev: true }).js.code
      }
      if (/\.svelte\.(ts|js)$/.test(id)) {
        // compileModule reads JavaScript: strip the types first.
        const js = id.endsWith(".ts") ? transformSync(id, code).code : code
        return compileModule(js, { filename: id, generate, dev: true }).js.code
      }
      return null
    },
  }
}

/** The fixture built for `generate`, written beside the package and imported. */
export async function build<T>(fixture: string, generate: "server" | "client"): Promise<T> {
  const bundle = await rolldown({
    input: join(here, fixture),
    external: [/^svelte\//, /^@rind-ui\/core/, /^esm-env/],
    resolve: { conditionNames: ["@rind-ui/source", "svelte", "browser", "import", "default"] },
    plugins: [sveltePlugin(generate)],
  })
  const { output } = await bundle.generate({ format: "esm" })
  const file = join(out, `${fixture.replace(/\W/g, "_")}.${generate}.${Date.now()}.mjs`)
  mkdirSync(out, { recursive: true })
  writeFileSync(file, output[0].code)
  return (await import(/* @vite-ignore */ file)) as T
}
