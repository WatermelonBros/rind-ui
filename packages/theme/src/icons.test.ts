/// <reference types="node" />
// The generated icon tokens (decision 0010): names, shape, no runtime dependency, freshness.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const script = new URL("../scripts/build-icons.mjs", import.meta.url).pathname
const generate = (...args: string[]) =>
  execFileSync("node", [script, "--stdout", ...args], { encoding: "utf8" })

const NAMES = [
  "check",
  "minus",
  "x",
  "caret-down",
  "caret-up",
  "caret-left",
  "caret-right",
  "magnifying-glass",
  "eye",
  "eye-slash",
  "plus",
  "calendar",
  "clock",
  "warning",
  "info",
  "check-circle",
  "x-circle",
  "dots-three",
  "arrow-left",
  "arrow-right",
  "copy",
]
const tokens = (css: string) =>
  [...css.matchAll(/--rind-icon-([a-z-]+): (url\("data:image\/svg\+xml,[^"]+"\));/g)].map(
    (m) => [m[1], m[2]] as const,
  )

describe("icons.css", () => {
  const css = read("./icons.css")

  it("declares every token as a data:image/svg+xml url, inside @layer rind", () => {
    expect(tokens(css).map(([name]) => name)).toEqual(NAMES)
    const inner = css.slice(css.indexOf("@layer rind {"))
    expect(inner).toMatch(/^@layer rind \{\n {2}:where\(:root\) \{/)
    expect(css.match(/--rind-icon-/g)).toHaveLength(NAMES.length)
    // Declarations only inside the layer: nothing follows its closing brace.
    expect(css.trimEnd().endsWith("  }\n}")).toBe(true)
  })

  it("is up to date with the default weight (byte-identical regeneration)", () => {
    expect(generate()).toBe(css)
  })

  it("weight bold keeps the token names and changes the glyphs", () => {
    const bold = tokens(generate("--weight", "bold"))
    const regular = tokens(css)
    expect(bold.map(([n]) => n)).toEqual(NAMES)
    expect(bold.every(([n, url], i) => url !== regular[i]?.[1] && n === regular[i]?.[0])).toBe(true)
  })
})

describe("package", () => {
  it("has @phosphor-icons/core only in devDependencies", () => {
    const pkg = JSON.parse(read("../package.json")) as Record<string, Record<string, string>>
    expect(pkg["devDependencies"]).toHaveProperty("@phosphor-icons/core")
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      expect(pkg[field] ?? {}).not.toHaveProperty("@phosphor-icons/core")
    }
  })

  it("NOTICE carries Phosphor's MIT licence text", () => {
    const notice = read("../NOTICE")
    expect(notice).toContain("Phosphor Icons")
    expect(notice).toContain("MIT License")
    expect(notice).toContain("Permission is hereby granted, free of charge")
  })
})
