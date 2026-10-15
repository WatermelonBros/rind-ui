/// <reference types="node" />
// Typeahead and navigation against the BUILT package, minified (add-collections 7.6): a
// minifier that renames or inlines the wrong thing would only show here, never in the sources.
// `dist` is the published (unminified) build; the test minifies a copy of it with tsdown so
// the published output is never touched.
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

type Core = typeof import("@rind-ui/core")

const coreDir = join(import.meta.dirname, "../../../core")
const out = mkdtempSync(join(tmpdir(), "rind-minified-"))
let core: Core

beforeAll(async () => {
  if (!existsSync(join(coreDir, "dist/index.mjs"))) {
    throw new Error("build @rind-ui/core first: pnpm --filter @rind-ui/core build")
  }
  execFileSync("pnpm", ["exec", "tsdown", "--minify", "--no-dts", "--no-publint", "-d", out], {
    cwd: coreDir,
    stdio: "pipe",
  })
  core = (await import(pathToFileURL(join(out, "index.mjs")).href)) as Core
}, 60_000)

afterAll(() => rmSync(out, { recursive: true, force: true }))

interface Row {
  text: string
  disabled?: boolean
}
const list = (rows: (string | Row)[]) =>
  core.createListCollection<Row>({
    items: rows.map((r) => (typeof r === "string" ? { text: r } : r)),
    getKey: (r) => r.text,
    getText: (r) => r.text,
    isDisabled: (r) => r.disabled === true,
  })

/** Types chars 10 ms apart, moving the highlight to each match like the machine does. */
function type(rows: (string | Row)[], chars: string[], locale = "en") {
  const c = list(rows)
  const options = {
    timeout: 1000,
    collator: core.collator(locale),
    navigable: core.navigableWhen(false),
  }
  let state = core.idleTypeahead
  let from: ReturnType<typeof core.toKey> | null = null
  const trail: (string | null)[] = []
  let now = 0
  for (const char of chars) {
    now += 10
    const r = core.typeahead(state, { char, now }, c, from, options)
    state = r.state
    if (r.key !== null) from = r.key
    trail.push(r.key)
  }
  return trail
}

describe("minified @rind-ui/core", () => {
  it("repeated letter cycles", () => {
    expect(type(["Dog", "Duck", "Deer"], ["d", "d", "d"])).toEqual(["Dog", "Duck", "Deer"])
  })

  it("a growing query stays on the matching item", () => {
    expect(type(["Bob A", "Bob B"], ["B", "o", "b", " ", "B"]).at(-1)).toBe("Bob B")
    expect(type(["Bob A", "Bob B"], ["B", "o", "b", " ", "A"]).at(-1)).toBe("Bob A")
  })

  it("is accent-insensitive", () => {
    expect(type(["Bureau", "École"], ["e"], "fr")).toEqual(["École"])
  })

  it("an all-disabled collection returns without hanging", () => {
    const c = list([
      { text: "a", disabled: true },
      { text: "b", disabled: true },
    ])
    const options = { loop: true, navigable: core.navigableWhen(false) }
    expect(core.move(c, null, "next", options)).toBeNull()
    expect(core.move(c, null, "page-next", options)).toBeNull()
    expect(type([{ text: "a", disabled: true }], ["a"])).toEqual([null])
  })

  it("navigation skips a run of disabled items, stops at the ends and loops", () => {
    const c = list(["a", { text: "b", disabled: true }, { text: "c", disabled: true }, "d", "e"])
    const navigable = core.navigableWhen(false)
    const key = core.toKey
    expect(core.move(c, key("a"), "next", { loop: false, navigable })).toBe("d")
    expect(core.move(c, key("d"), "previous", { loop: false, navigable })).toBe("a")
    expect(core.move(c, key("e"), "next", { loop: false, navigable })).toBe("e")
    expect(core.move(c, key("e"), "next", { loop: true, navigable })).toBe("a")
    expect(core.move(c, key("a"), "page-next", { loop: false, navigable, pageSize: 10 })).toBe("e")
  })
})
