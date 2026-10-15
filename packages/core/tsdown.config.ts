import { defineConfig } from "tsdown"

export default defineConfig({
  // `machine` is a separate entry so scripts/size.mjs can measure the runtime alone.
  entry: { index: "src/index.ts", machine: "src/machine/index.ts" },
  dts: true,
  publint: true,
})
