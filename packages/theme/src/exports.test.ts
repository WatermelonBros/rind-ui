/// <reference types="node" />
// The package.json exports map serves the stylesheets: every exported CSS file exists and the
// bundler is told CSS has side effects (otherwise tree-shaking drops a bare `import "…css"`).
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = new URL("../", import.meta.url)
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as {
  exports: Record<string, unknown>
  sideEffects: string[]
}
const exists = (p: string) => existsSync(new URL(p, root))

describe("package exports", () => {
  it("maps the stylesheet entries and the builder", () => {
    for (const key of ["./tokens.css", "./variants.css", "./presets/*.css", "./*.css", "./builder"])
      expect(pkg.exports, key).toHaveProperty([key])
  })

  it("every exported CSS file exists", () => {
    for (const [key, target] of Object.entries(pkg.exports)) {
      if (typeof target !== "string" || !target.endsWith(".css")) continue
      if (!target.includes("*")) {
        expect(exists(target), `${key} -> ${target}`).toBe(true)
        continue
      }
      // A pattern export: its directory must hold at least one matching file.
      const dir = target.slice(0, target.lastIndexOf("/") + 1)
      expect(
        readdirSync(new URL(dir, root)).some((f) => f.endsWith(".css")),
        key,
      ).toBe(true)
    }
  })

  it("marks CSS as side-effectful", () => {
    expect(pkg.sideEffects).toContain("*.css")
  })

  it("index.css imports icons.css", () => {
    const index = readFileSync(new URL("src/index.css", root), "utf8")
    expect(index).toContain('@import "./icons.css";')
  })
})
