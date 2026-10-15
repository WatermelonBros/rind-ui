import { describe, expect, it } from "vitest"
import {
  contrast,
  formatOklch,
  gamutMap,
  inGamut,
  luminance,
  type Oklch,
  oklchToRgb,
  parseColor,
  rgbToOklch,
} from "./color"
import fixtures from "./color-fixtures.json"

const p = (s: string): Oklch => {
  const c = parseColor(s)
  if (!c) throw new Error(`unparsable: ${s}`)
  return c
}

describe("WCAG contrast", () => {
  it("matches the reference ratios", () => {
    expect(contrast(p("white"), p("black"))).toBeCloseTo(21, 2)
    expect(contrast(p("#777"), p("white"))).toBeCloseTo(4.48, 2)
    expect(contrast(p("#767676"), p("white"))).toBeCloseTo(4.54, 2)
    expect(contrast(p("rgb(255,0,0)"), p("white"))).toBeCloseTo(4.0, 1)
    expect(contrast(p("black"), p("white"))).toBe(contrast(p("white"), p("black")))
  })

  it("computes luminance of the extremes", () => {
    expect(luminance(p("white"))).toBeCloseTo(1, 5)
    expect(luminance(p("black"))).toBeCloseTo(0, 5)
  })
})

describe("OKLCH <-> sRGB", () => {
  it("round-trips hex within 1/255", () => {
    for (const { hex } of fixtures) {
      const rgb = oklchToRgb(p(hex))
      const back = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      expect(Math.abs(rgb.r - (back[0] ?? 0))).toBeLessThan(1 / 255)
      expect(Math.abs(rgb.g - (back[1] ?? 0))).toBeLessThan(1 / 255)
      expect(Math.abs(rgb.b - (back[2] ?? 0))).toBeLessThan(1 / 255)
      const again = rgbToOklch(rgb)
      expect(again.l).toBeCloseTo(p(hex).l, 6)
    }
  })

  it("knows reference values", () => {
    const red = p("#ff0000")
    expect(red.l).toBeCloseTo(0.628, 3)
    expect(red.c).toBeCloseTo(0.2577, 3)
    expect(red.h).toBeCloseTo(29.23, 1)
    const white = p("#fff")
    expect(white.l).toBeCloseTo(1, 5)
    expect(white.c).toBe(0)
  })

  it.each(fixtures)("fixture $hex", ({ hex, l, c, h }) => {
    const got = p(hex)
    expect(Math.abs(got.l - l)).toBeLessThan(1e-3)
    expect(Math.abs(got.c - c)).toBeLessThan(1e-3)
    if (c > 0.001) expect(Math.abs(got.h - h)).toBeLessThan(1e-3 * 100)
  })
})

describe("parseColor", () => {
  const same = (a: string, b: string) => {
    const x = p(a)
    const y = p(b)
    expect(x.l).toBeCloseTo(y.l, 4)
    expect(x.c).toBeCloseTo(y.c, 4)
    expect(x.alpha).toBeCloseTo(y.alpha, 4)
    if (x.c > 1e-4) expect(x.h).toBeCloseTo(y.h, 1)
  }

  it("parses hex forms", () => {
    same("#f00", "#ff0000")
    same("#f008", "#ff000088")
    same("#FF0000", "red")
    expect(p("#ff000080").alpha).toBeCloseTo(128 / 255, 5)
  })

  it("parses rgb in legacy and modern syntax", () => {
    same("rgb(255, 0, 0)", "#f00")
    same("rgb(255 0 0)", "#f00")
    same("rgb(100% 0% 0%)", "#f00")
    same("rgba(255, 0, 0, 0.5)", "rgb(255 0 0 / 50%)")
    same("rgb(255 0 0 / 50%)", "rgb(255 0 0 / 0.5)")
    same("rgb(none 0 0)", "rgb(0 0 0)")
  })

  it("parses hsl with every angle unit", () => {
    same("hsl(120, 100%, 25.098%)", "green")
    same("hsl(120deg 100% 25.098%)", "green")
    same("hsl(0.3333333333turn 100% 25.098%)", "green")
    same("hsl(2.0943951rad 100% 25.098%)", "green")
    same("hsl(133.3333333grad 100% 25.098%)", "green")
    same("hsla(0, 100%, 50%, 0.5)", "rgba(255, 0, 0, 0.5)")
  })

  it("parses oklch and oklab", () => {
    expect(p("oklch(0.5 0.1 200)")).toEqual({ l: 0.5, c: 0.1, h: 200, alpha: 1 })
    expect(p("oklch(50% 25% 200deg / 0.5)")).toEqual({ l: 0.5, c: 0.1, h: 200, alpha: 0.5 })
    expect(p("oklch(0.5 none none)")).toEqual({ l: 0.5, c: 0, h: 0, alpha: 1 })
    const lab = p("oklab(0.5 0.1 0)")
    expect(lab.c).toBeCloseTo(0.1, 6)
    expect(lab.h).toBeCloseTo(0, 6)
    same("oklab(0.628 0.2249 0.1258)", "#f00")
  })

  it("parses named colours, case-insensitively and with whitespace", () => {
    same("  RebeccaPurple ", "#663399")
    same("papayawhip", "#ffefd5")
    expect(p("transparent").alpha).toBe(0)
  })

  it.each([
    "",
    "nope",
    "#12",
    "#ggg",
    "rgb(1 2)",
    "rgb(1, 2 3)",
    "hsl(0 1 1 1 1)",
    "oklch(1)",
    "rgb(1 2 3 / 1 / 2)",
    "rgb(1px 2 3)",
    "blue!",
  ])("rejects %j", (s) => expect(parseColor(s)).toBeNull())
})

describe("gamut mapping", () => {
  it("reduces chroma of out-of-gamut colours, keeping L and H", () => {
    const wild: Oklch = { l: 0.7, c: 0.4, h: 150, alpha: 1 }
    expect(inGamut(wild)).toBe(false)
    const mapped = gamutMap(wild)
    expect(inGamut(mapped)).toBe(true)
    expect(Math.abs(mapped.l - 0.7)).toBeLessThan(0.001)
    expect(Math.abs(mapped.h - 150)).toBeLessThan(0.5)
    expect(mapped.c).toBeLessThan(wild.c)
  })

  it("leaves in-gamut colours unchanged and clamps L", () => {
    const ok = p("#0a7d55")
    expect(gamutMap(ok)).toEqual(ok)
    expect(gamutMap({ l: 1.2, c: 0.3, h: 10, alpha: 1 })).toMatchObject({ l: 1, c: 0 })
    expect(gamutMap({ l: -1, c: 0.3, h: 10, alpha: 1 })).toMatchObject({ l: 0, c: 0 })
  })
})

describe("formatOklch", () => {
  it("rounds and is deterministic", () => {
    expect(formatOklch({ l: 0.628, c: 0.25768, h: 29.234, alpha: 1 })).toBe(
      "oklch(0.628 0.2577 29.23)",
    )
    expect(formatOklch({ l: 1, c: 0, h: 0, alpha: 1 })).toBe("oklch(1 0 0)")
    expect(formatOklch({ l: 0.5, c: 0.1, h: 359.999, alpha: 0.5 })).toBe("oklch(0.5 0.1 0 / 0.5)")
  })
})
