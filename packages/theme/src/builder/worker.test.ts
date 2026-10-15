import { Worker } from "node:worker_threads"
import { describe, expect, it } from "vitest"

// Spec "Server build per request": the builder runs where `document` and `window` do not
// exist. The worker loads the TypeScript sources with Node's own type stripping (extensionless
// relative imports are mapped to .ts by a resolve hook), so no bundler or build output is needed.
const entry = new URL("./index.ts", import.meta.url).href

const script = `
const { parentPort, workerData } = require("node:worker_threads")
const { registerHooks } = require("node:module")
registerHooks({
  resolve(specifier, context, next) {
    const relative = specifier.startsWith("./") && !/\\.[cm]?[jt]s$/.test(specifier)
    return next(relative ? specifier + ".ts" : specifier, context)
  },
})
const seen = { document: typeof document, window: typeof window }
// Any access to a DOM global after load would be a bug: make it loud.
for (const key of ["document", "window", "navigator", "CSS", "getComputedStyle"]) {
  Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error("global accessed: " + key) } })
}
import(workerData.entry).then((m) => {
  const a = m.defineTheme({ name: "tenant-1", accent: "#0a7d55", contrast: "adjust" })
  const b = m.defineTheme({ name: "tenant-1", accent: "#0a7d55", contrast: "adjust" })
  parentPort.postMessage({ seen, css: a.css, same: a.css === b.css, ok: a.report.ok, dtcg: Object.keys(a.toDTCG()) })
}).catch((e) => parentPort.postMessage({ error: String(e && e.stack || e) }))
`

describe("runs without a DOM", () => {
  it("defineTheme works in a worker thread with no document or window", async () => {
    const worker = new Worker(script, { eval: true, workerData: { entry } })
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      worker.once("message", resolve)
      worker.once("error", reject)
    })
    await worker.terminate()
    expect(result["error"]).toBeUndefined()
    expect(result["seen"]).toEqual({ document: "undefined", window: "undefined" })
    expect(result["ok"]).toBe(true)
    expect(result["same"]).toBe(true)
    expect(result["css"]).toContain(':where([data-rind-theme="tenant-1"])')
    expect(result["dtcg"]).toEqual(["brand", "light", "dark"])
  })
})
