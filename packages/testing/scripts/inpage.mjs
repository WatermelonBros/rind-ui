// Bundles src/inpage.ts (and dom-accessibility-api) into one self-contained IIFE that the
// Playwright adapter injects into pages: dist/inpage.iife.js.
import { rolldown } from "rolldown"

const bundle = await rolldown({ input: new URL("../src/inpage.ts", import.meta.url).pathname })
await bundle.write({
  file: new URL("../dist/inpage.iife.js", import.meta.url).pathname,
  format: "iife",
  minify: true,
})
console.log("dist/inpage.iife.js written")
