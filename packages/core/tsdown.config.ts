import { readFileSync } from "node:fs"
import { defineConfig } from "tsdown"
import { packageExports } from "../../scripts/tsdown-exports.ts"

// Unbundled: one output file per source module, so a bundler drops every module an app does
// not reach (`"sideEffects": false` works per file). Every component the root exports also
// gets its own entry, `@rind-ui/core/<component>`; `shared` is not a component. `qr` is the
// encoder's public entry (`@rind-ui/core/qr`), usable without the component; `internal` holds
// the Color Picker's parts for the adapters (not public API); `machine` is an entry only so
// scripts/size.mjs can measure the runtime alone, and is not exported.
const components = [...readFileSync("src/index.ts", "utf8").matchAll(/"\.\/components\/([\w-]+)"/g)]
  .map((match) => match[1])
  .filter((name) => name !== "shared")
  .map((name) => `src/components/${name}/index.ts`)

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/machine/index.ts",
    "src/qr/index.ts",
    "src/internal.ts",
    ...components,
  ],
  unbundle: true,
  dts: true,
  publint: true,
  report: { summary: true },
  exports: {
    ...packageExports,
    exclude: ["machine/index"],
    customExports: (exports) =>
      Object.fromEntries(
        Object.entries(packageExports.customExports(exports)).map(([key, entry]) => [
          key.replace(/^\.\/components\//, "./"),
          entry,
        ]),
      ),
  },
})
