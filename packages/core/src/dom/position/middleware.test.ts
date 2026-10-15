import { describe, expect, it } from "vitest"
import type { PositioningOptions } from "../../env/position"
import { middlewareFor, splitPlacement, transformOrigin } from "./middleware"
import { positioningPresets } from "./options"

const floating = { x: 50, y: 20, width: 200, height: 100 }
const base = { rtl: false, floating } as const

describe("splitPlacement", () => {
  it("splits side and align, centre when absent", () => {
    expect(splitPlacement("top")).toEqual({ side: "top", align: "center" })
    expect(splitPlacement("left-end")).toEqual({ side: "left", align: "end" })
    expect(splitPlacement("bottom-start")).toEqual({ side: "bottom", align: "start" })
  })
})

describe("transformOrigin", () => {
  it("is the arrow tip on each side", () => {
    const v = { x: 10, width: 10, height: 5 }
    const h = { y: 4, width: 8, height: 6 }
    expect(transformOrigin({ ...base, side: "bottom", align: "center", arrow: v })).toBe(
      "15px -5px",
    )
    expect(transformOrigin({ ...base, side: "top", align: "center", arrow: v })).toBe("15px 105px")
    expect(transformOrigin({ ...base, side: "right", align: "center", arrow: h })).toBe("-8px 7px")
    expect(transformOrigin({ ...base, side: "left", align: "center", arrow: h })).toBe("208px 7px")
  })

  it("treats a missing arrow coordinate as 0", () => {
    expect(
      transformOrigin({ ...base, side: "bottom", align: "start", arrow: { width: 10, height: 5 } }),
    ).toBe("5px -5px")
  })

  it.each([
    ["bottom", "start", false, "0% 0%"],
    ["bottom", "end", false, "100% 0%"],
    ["bottom", "center", false, "50% 0%"],
    ["top", "start", false, "0% 100%"],
    ["bottom", "start", true, "100% 0%"],
    ["bottom", "end", true, "0% 0%"],
    ["right", "start", false, "0% 0%"],
    ["right", "end", false, "0% 100%"],
    ["left", "end", false, "100% 100%"],
    ["left", "center", false, "100% 50%"],
    ["left", "start", true, "100% 0%"],
  ] as const)("without arrow: %s-%s rtl=%s is %s", (side, align, rtl, expected) => {
    expect(transformOrigin({ floating, side, align, rtl })).toBe(expected)
  })

  it("a point anchor gives the point relative to the floating element", () => {
    // Context menu near the bottom-right corner: placed up-left of the pointer.
    const pointer = { x: floating.x + floating.width, y: floating.y + floating.height }
    expect(transformOrigin({ ...base, side: "left", align: "end", point: pointer })).toBe(
      "200px 100px",
    )
    expect(
      transformOrigin({ ...base, side: "right", align: "start", point: { x: 50, y: 20 } }),
    ).toBe("0px 0px")
  })
})

describe("middlewareFor", () => {
  const arrowEl = {} as HTMLElement // never touched: only stored in the middleware options
  const els = (arrow: HTMLElement | null = null) => ({ arrow, boundary: null, onSize: () => {} })
  const names = (o: PositioningOptions, arrow: HTMLElement | null = null, lock = null) =>
    middlewareFor(o, "bottom", els(arrow), lock).map((m) => m.name)

  it("popup (aligned centre): offset, shift?, flip... order for centred is shift before flip", () => {
    const o: PositioningOptions = {
      ...positioningPresets.popup,
      collisionAvoidance: { side: "flip", align: "shift", fallbackAxis: "end" },
    }
    expect(names(o)).toEqual(["offset", "shift", "flip", "size", "hide"])
  })

  it("aligned popups flip before shift", () => {
    expect(names(positioningPresets.dropdown)).toEqual(["offset", "flip", "shift", "size", "hide"])
  })

  it("inline is resolved by the tracker (line box), not a middleware; arrow only with an element", () => {
    const o = { ...positioningPresets.dropdown, inline: true }
    expect(names(o, arrowEl)).toEqual(["offset", "flip", "shift", "size", "arrow", "hide"])
  })

  it("a lock placement leaves out flip", () => {
    expect(names(positioningPresets.dropdown, null, "bottom-start" as never)).toEqual([
      "offset",
      "shift",
      "size",
      "hide",
    ])
  })

  it("flip padding on the preferred side is 1 less; shift and size are unbiased", () => {
    const ms = middlewareFor(positioningPresets.dropdown, "bottom", els(), null)
    const opts = (n: string) =>
      ms.find((m) => m.name === n)?.options as { padding?: Record<string, number> } | undefined
    expect(opts("flip")?.padding).toEqual({ top: 8, right: 8, bottom: 7, left: 8 })
    expect(opts("shift")?.padding).toEqual({ top: 8, right: 8, bottom: 8, left: 8 })
    expect(opts("size")?.padding).toEqual({ top: 8, right: 8, bottom: 8, left: 8 })
  })
})

describe("centred popups", () => {
  it("align flip on a centred popup slides instead (a centre cannot flip)", () => {
    const o = { ...positioningPresets.popup, align: "center" as const }
    const list = middlewareFor(o, "bottom", { arrow: null, boundary: null, onSize: () => {} }, null)
    const shiftM = list.find((m) => m.name === "shift")
    expect(shiftM).toBeDefined()
  })
})
