/// <reference types="node" />
// Task 0.2 (decision 0009): @internationalized/number is tree-shaken out of a bundle without
// numeric fields, and the Number Input bundle's added size is recorded.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { rolldown } from "rolldown"
import { afterAll, describe, expect, it } from "vitest"

const dir = mkdtempSync(join(tmpdir(), "rind-size-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const core = join(import.meta.dirname, "../../core/src/index.ts")

async function bundle(code: string): Promise<string> {
  const entry = join(dir, `${Math.random().toString(36).slice(2)}.ts`)
  writeFileSync(entry, code)
  const b = await rolldown({
    input: entry,
    platform: "browser",
    resolve: { conditionNames: ["@rind-ui/source", "browser", "import", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    logLevel: "silent",
  })
  const { output } = await b.generate({ format: "esm", minify: true })
  return output[0].code
}

describe("@internationalized/number tree shaking", () => {
  it("a component without numeric fields bundles none of it", { timeout: 60_000 }, async () => {
    const code = await bundle(
      `import { sliderMachine } from ${JSON.stringify(core)}\nconsole.log(sliderMachine)`,
    )
    expect(code).not.toMatch(/NumberParser|isValidPartialNumber/)
  })

  it("the Number Input bundle includes it; its added size is recorded", {
    timeout: 60_000,
  }, async () => {
    const without = await bundle(
      `import { sliderMachine } from ${JSON.stringify(core)}\nconsole.log(sliderMachine)`,
    )
    const withIt = await bundle(
      `import { numberInputMachine, createNumberParser } from ${JSON.stringify(core)}\nconsole.log(numberInputMachine, createNumberParser("en"))`,
    )
    expect(withIt).toMatch(/isValidPartialNumber|NumberParser/)
    const added = withIt.length - without.length
    console.info(
      `[rind-ui] number-input bundle: +${(added / 1024).toFixed(1)} KiB minified over a Slider-only bundle`,
    )
    expect(added).toBeGreaterThan(0)
  })
})
