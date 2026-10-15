// Heading level and attribute rules that need no DOM (openspec heading). Bugs cited in the
// spec have named cases: mui/base-ui#1678, adobe/react-spectrum#2632 and #5077.
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  headingConnect,
  headingProps,
  nextHeadingLevel,
  resolveHeadingLevel,
  tooDeep,
  validHeadingLevel,
} from "./heading.connect"

const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {})
afterEach(() => vi.restoreAllMocks())

describe("resolveHeadingLevel", () => {
  const cases: [string, number | undefined, number | undefined, number][] = [
    ["default", undefined, undefined, 2],
    ["context", undefined, 4, 4],
    ["explicit wins over context (react-spectrum#2632)", 2, 4, 2],
    ["explicit without context", 5, undefined, 5],
    ["depth 7 clamps to 6", undefined, 7, 6],
    ["context 100 clamps to 6", undefined, 100, 6],
  ]
  it.each(cases)("%s", (_n, explicit, context, expected) => {
    expect(resolveHeadingLevel(explicit, context)).toBe(expected)
  })

  it("context is not validated and never warns", () => {
    const w = warn()
    resolveHeadingLevel(undefined, 7)
    expect(w).not.toHaveBeenCalled()
  })
})

describe("validHeadingLevel", () => {
  it.each([1, 2, 3, 4, 5, 6])("%i is valid and silent", (n) => {
    const w = warn()
    expect(validHeadingLevel(n)).toBe(n)
    expect(w).not.toHaveBeenCalled()
  })

  const bad: [number, number][] = [
    [0, 1],
    [-1, 1],
    [7, 6],
    [2.5, 3],
    [Number.NaN, 2],
    [Number.POSITIVE_INFINITY, 6],
  ]
  it.each(bad)(
    "%s clamps to %i and warns naming the value (adobe/react-spectrum#5077)",
    (v, expected) => {
      const w = warn()
      expect(validHeadingLevel(v)).toBe(expected)
      expect(w).toHaveBeenCalledTimes(1)
      expect(w.mock.calls[0]?.[0]).toContain(`level ${v} `)
    },
  )

  it("an explicit invalid level warns through resolveHeadingLevel", () => {
    const w = warn()
    expect(resolveHeadingLevel(0, 3)).toBe(1)
    expect(w).toHaveBeenCalledTimes(1)
  })
})

describe("nextHeadingLevel", () => {
  it("one more than the parent, 3 for the first Level (default parent 2)", () => {
    expect(nextHeadingLevel(undefined, undefined)).toBe(3)
    expect(nextHeadingLevel(3, undefined)).toBe(4)
  })
  it("stays unclamped so depth can be detected", () => {
    expect(nextHeadingLevel(6, undefined)).toBe(7)
    expect(tooDeep(7)).toBe(true)
    expect(tooDeep(6)).toBe(false)
    expect(tooDeep(undefined)).toBe(false)
  })
  it("an explicit level is used exactly", () => {
    expect(nextHeadingLevel(5, 1)).toBe(1)
  })
  it("an invalid explicit level is clamped with a warning", () => {
    const w = warn()
    expect(nextHeadingLevel(2, 9)).toBe(6)
    expect(w).toHaveBeenCalledTimes(1)
    expect(w.mock.calls[0]?.[0]).toContain("level 9 ")
  })
  it("five nested Levels outside any Level reach 7", () => {
    let l: number | undefined
    for (let i = 0; i < 5; i++) l = nextHeadingLevel(l, undefined)
    expect(l).toBe(7)
    expect(resolveHeadingLevel(undefined, l)).toBe(6)
  })
})

describe("headingProps", () => {
  const cases: [number, string, Record<string, string | undefined>][] = [
    [2, "h2", { role: undefined, "aria-level": undefined, "data-level": "2" }],
    [3, "h3", { role: undefined, "aria-level": undefined, "data-level": "3" }],
    [2, "h4", { role: undefined, "aria-level": "2", "data-level": "2" }],
    [4, "h2", { role: undefined, "aria-level": "4", "data-level": "4" }],
    [3, "div", { role: "heading", "aria-level": "3", "data-level": "3" }],
    [6, "span", { role: "heading", "aria-level": "6", "data-level": "6" }],
    [1, "div", { role: "heading", "aria-level": "1", "data-level": "1" }],
  ]
  it.each(cases)("level %i on <%s> (mui/base-ui#1678)", (level, tag, expected) => {
    expect(headingProps({ level: level as 1, tag })).toEqual(expected)
  })

  it("never emits aria-level above 6", () => {
    const level = resolveHeadingLevel(undefined, 7)
    expect(headingProps({ level, tag: "div" })["aria-level"]).toBe("6")
  })
})

describe("headingConnect", () => {
  it("carries the scope attributes and the level data", () => {
    const p = headingConnect({ level: 3, tag: "h3", instance: "i1" })
    expect(p["data-scope"]).toBe("heading")
    expect(p["data-part"]).toBe("root")
    expect(p["data-instance"]).toBe("i1")
    expect(p["data-level"]).toBe("3")
  })
})

describe("infinite levels clamp to the nearest valid level", () => {
  it("Infinity → 6, -Infinity → 1, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(validHeadingLevel(Number.POSITIVE_INFINITY)).toBe(6)
    expect(validHeadingLevel(Number.NEGATIVE_INFINITY)).toBe(1)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})
