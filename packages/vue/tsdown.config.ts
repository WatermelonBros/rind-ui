import { existsSync, readdirSync } from "node:fs"
import { defineConfig } from "tsdown"
import { namespaceReexports } from "../../scripts/namespace-reexports.ts"
import { packageExports } from "../../scripts/tsdown-exports.ts"

// As @rind-ui/react: unbundled, one entry per component (`@rind-ui/vue/<component>`), written
// to package.json `exports` by the build. The site reads those entries to know which
// components the Vue package ships.
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
