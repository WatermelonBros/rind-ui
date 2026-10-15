import { defineConfig } from "tsdown"

// Only the builder is code; the stylesheets ship as source CSS.
export default defineConfig({
  entry: { builder: "src/builder/index.ts" },
  tsconfig: "tsconfig.build.json",
  dts: true,
  publint: true,
})
