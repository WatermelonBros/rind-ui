import { defineConfig } from "tsdown"

export default defineConfig({
  entry: { index: "src/index.ts", server: "src/server.ts" },
  platform: "node",
  dts: true,
  publint: true,
})
