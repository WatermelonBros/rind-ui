import { existsSync, readdirSync } from "node:fs"
import { defineConfig } from "tsdown"
import { namespaceReexports } from "../../scripts/namespace-reexports.ts"
import { packageExports } from "../../scripts/tsdown-exports.ts"
import { solidPlugin } from "./scripts/solid-plugin.ts"

// As @rind-ui/react: unbundled, one entry per component (`@rind-ui/solid/<component>`), written
// to package.json `exports` by the build. Two outputs side by side, as Solid libraries ship:
// `.jsx` with the JSX kept (the `solid` condition: the consumer's compiler makes its DOM or
// server build) and `.mjs` compiled for the DOM (`default`).
const components = readdirSync("src", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`src/${entry.name}/index.ts`))
  .map((entry) => `src/${entry.name}/index.ts`)
const entry = ["src/index.ts", ...components]

type Entry = string | { readonly default?: string; readonly [condition: string]: unknown }
/** Adds the `solid` condition (the `.jsx` beside each `.mjs`) before `default`. */
const withSolid = (exports: Record<string, Entry>): Record<string, Entry> =>
  Object.fromEntries(
    Object.entries(packageExports.customExports(exports)).map(([key, value]) => {
      if (typeof value === "string" || !value.default?.endsWith(".mjs")) return [key, value]
      const { default: js, ...conditions } = value
      return [key, { ...conditions, solid: js.replace(/\.mjs$/, ".jsx"), default: js }]
    }),
  )

export default defineConfig([
  {
    entry,
    tsconfig: "tsconfig.build.json",
    unbundle: true,
    dts: true,
    publint: true,
    report: { summary: true },
    exports: { devExports: packageExports.devExports, customExports: withSolid },
    plugins: [solidPlugin({ generate: "dom" }), namespaceReexports],
  },
  {
    entry,
    tsconfig: "tsconfig.build.json",
    unbundle: true,
    dts: false,
    clean: false,
    outExtensions: () => ({ js: ".jsx" }),
    inputOptions: { transform: { jsx: "preserve" } },
    plugins: [namespaceReexports],
  },
])
