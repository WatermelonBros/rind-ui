import { existsSync, readdirSync } from "node:fs"
import { defineConfig } from "tsdown"
import { namespaceReexports } from "../../scripts/namespace-reexports.ts"
import { packageExports } from "../../scripts/tsdown-exports.ts"

// Unbundled: one output file per source module, so a bundler drops every component an app
// does not import (`"sideEffects": false` works per file). Each component also gets its own
// entry, `@rind-ui/react/<component>`, written to package.json `exports` by the build.
const components = readdirSync("src", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`src/${entry.name}/index.ts`))
  .map((entry) => `src/${entry.name}/index.ts`)

export default defineConfig({
  entry: ["src/index.ts", ...components],
  tsconfig: "tsconfig.build.json",
  unbundle: true,
  dts: true,
  publint: true,
  report: { summary: true },
  exports: packageExports,
  plugins: [namespaceReexports],
})
