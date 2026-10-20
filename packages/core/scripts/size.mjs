// Fails the build when the machine runtime exceeds its budget (openspec machine-runtime
// "Size Budget"): the built `machine` entry, minified for production, then gzipped.
import { gzipSync } from "node:zlib"
import { rolldown } from "rolldown"

const BUDGET = 2.5 * 1024

const bundle = await rolldown({
  input: new URL("../dist/machine/index.mjs", import.meta.url).pathname,
  transform: { define: { "process.env.NODE_ENV": '"production"' } },
})
const { output } = await bundle.generate({ minify: true, format: "esm" })
const code = output.map((chunk) => ("code" in chunk ? chunk.code : "")).join("")
const size = gzipSync(code, { level: 9 }).length

console.log(`machine runtime: ${size} B min+gz (budget ${BUDGET} B)`)
if (size > BUDGET) {
  console.error("machine runtime is over its size budget")
  process.exit(1)
}

// Positioning is not part of domEnvironment(): a bundle with only overlay pieces (a Dialog)
// must not carry Floating UI (openspec floating-positioning, design §2).
const dialogOnly = await rolldown({
  input: "virtual:dialog-only",
  plugins: [
    {
      name: "dialog-only-entry",
      resolveId: (id) => (id === "virtual:dialog-only" ? id : null),
      load: (id) =>
        id === "virtual:dialog-only"
          ? `export { domEnvironment, overlayEffect } from ${JSON.stringify(new URL("../dist/index.mjs", import.meta.url).pathname)}`
          : null,
    },
  ],
  transform: { define: { "process.env.NODE_ENV": '"production"' } },
})
const dialogOut = await dialogOnly.generate({ format: "esm" })
const carried = dialogOut.output.some(
  (chunk) => "moduleIds" in chunk && chunk.moduleIds.some((m) => m.includes("@floating-ui")),
)
console.log(`dialog-only bundle carries Floating UI: ${carried ? "yes" : "no"}`)
if (carried) {
  console.error("Floating UI leaked into a bundle without positioning")
  process.exit(1)
}
