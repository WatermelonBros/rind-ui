// Fails the build when the machine runtime exceeds its budget (openspec machine-runtime
// "Size Budget"): the built `machine` entry, minified for production, then gzipped.
import { gzipSync } from "node:zlib"
import { rolldown } from "rolldown"

const BUDGET = 2.5 * 1024

const bundle = await rolldown({
  input: new URL("../dist/machine.mjs", import.meta.url).pathname,
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
