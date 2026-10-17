import { defineConfig } from "tsdown"

export default defineConfig({
  // `machine` is a separate entry so scripts/size.mjs can measure the runtime alone; `qr` is
  // the encoder's public entry (`@rind-ui/core/qr`), usable without the component.
  entry: { index: "src/index.ts", machine: "src/machine/index.ts", qr: "src/qr/index.ts" },
  dts: true,
  publint: true,
})
