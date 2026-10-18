// Task 1.2: no module of core reads the clock at module scope (`today` comes from the
// injected DateClock, so the server, the browser and tests agree).
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(import.meta.dirname, "../packages/core/src")

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return sources(path)
    return /\.ts$/.test(e.name) && !/\.test(-d)?\.ts$/.test(e.name) ? [path] : []
  })
}

/** Lines at module scope (no indentation) that read the clock. */
const offenders = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /^\S/.test(line) && /\bDate\.now\(|\bnew Date\(/.test(line))
    .map(({ n }) => `${file.slice(root.length + 1)}:${n}`)

describe("no module-scope clock reads in core", () => {
  it("no top-level Date.now() or new Date()", () => {
    expect(sources(root).flatMap(offenders)).toEqual([])
  })
})
