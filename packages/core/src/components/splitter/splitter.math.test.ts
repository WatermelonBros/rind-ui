// The Splitter's resize math in Node (task 1.3): validation, clamping with the collapse snap,
// resize by delta across three panels, and the handles' ARIA bounds.
import { describe, expect, it } from "vitest"
import { resolveConstraints, splitterDelta, splitterKeyEvent } from "./splitter.connect"
import { clampSize, handleBounds, resizeAt, resolveSizes, validateSizes } from "./splitter.math"

const near = (a: readonly number[]) => a.map((n) => Math.round(n * 1000) / 1000)

describe("resolveSizes / validateSizes", () => {
  it("equal split without sizes; wrong length falls back to defaults", () => {
    expect(near(resolveSizes(undefined, undefined, [{}, {}, {}]))).toEqual([33.333, 33.333, 33.333])
    expect(resolveSizes([10], [25, 75], [{}, {}])).toEqual([25, 75])
    expect(resolveSizes([Number.NaN, 50], undefined, [{}, {}])).toEqual([50, 50])
  })

  it("scales to 100 and clamps, giving the rest to who accepts it (Ark#2967)", () => {
    expect(validateSizes([1, 3], [{}, {}])).toEqual([25, 75])
    expect(validateSizes([100, 0], [{}, { min: 20 }])).toEqual([80, 20])
  })
})

describe("clampSize", () => {
  it("snaps a collapsible panel at the halfway point between collapsed and min", () => {
    const c = { collapsible: true, min: 20, collapsedSize: 2 }
    expect(clampSize(c, 10)).toBe(2)
    expect(clampSize(c, 12)).toBe(20)
    expect(clampSize({ min: 20 }, 5)).toBe(20)
    expect(clampSize({ max: 60 }, 80)).toBe(60)
  })
})

describe("resizeAt", () => {
  const three = [{ min: 10 }, { min: 10 }, { min: 10 }]

  it("shrinks outward from the handle and grows the pivot", () => {
    expect(resizeAt([20, 30, 50], three, 0, 30, "pointer")).toEqual([50, 10, 40])
    expect(resizeAt([20, 30, 50], three, 1, -30, "pointer")).toEqual([10, 10, 80])
  })

  it("a step blocked on both sides returns the same array", () => {
    const sizes = [10, 90]
    expect(resizeAt(sizes, [{ min: 10 }, { max: 90 }], 0, -5, "pointer")).toBe(sizes)
    expect(resizeAt(sizes, [{}, {}], 3, 5, "pointer")).toBe(sizes)
  })

  it("keyboard collapses at min and expands to min whatever the step", () => {
    const c = [{ collapsible: true, min: 20 }, {}]
    expect(resizeAt([20, 80], c, 0, -5, "keyboard")).toEqual([0, 100])
    expect(resizeAt([0, 100], c, 0, 5, "keyboard")).toEqual([20, 80])
  })

  it("a pointer past the halfway point expands a collapsed panel to min", () => {
    const c = [{ collapsible: true, min: 20 }, {}]
    expect(resizeAt([0, 100], c, 0, 15, "pointer")).toEqual([20, 80])
    expect(resizeAt([0, 100], c, 0, 5, "pointer")).toEqual([0, 100])
  })
})

describe("handleBounds (RRP#740)", () => {
  it("every handle uses its own pivot", () => {
    const three = [{ min: 10 }, { min: 10 }, { min: 10 }]
    expect(handleBounds([20, 30, 50], three, 0)).toEqual([10, 80])
    expect(handleBounds([20, 30, 50], three, 1)).toEqual([10, 70])
  })
})

describe("connect helpers", () => {
  it("resolves pixels against the space; skips them without one (RRP#536)", () => {
    const panels = [{ min: "200px", max: "80%", collapsedSize: 5 }] as const
    expect(resolveConstraints(panels, 1000)[0]).toEqual({
      min: 20,
      max: 80,
      collapsible: undefined,
      collapsedSize: 5,
    })
    expect(resolveConstraints(panels, null)[0]?.min).toBeUndefined()
    expect(resolveConstraints(panels, 0)[0]?.min).toBeUndefined()
  })

  it("a downward vertical move grows the top panel", () => {
    expect(splitterDelta(0.5, 0.4, "vertical", 1)).toBeCloseTo(10)
    expect(splitterDelta(0.5, 0.6, "horizontal", 1.25)).toBeCloseTo(12.5)
  })

  it("keys: own axis only, mirrored in RTL, no modifiers (zag#2417)", () => {
    const k = (key: string, more: Partial<Record<string, boolean>> = {}) =>
      ({
        key,
        alt: false,
        ctrl: false,
        meta: false,
        shift: false,
        composing: false,
        repeat: false,
        ...more,
      }) as never
    const h = { orientation: "horizontal", dir: "ltr", dragging: false } as const
    expect(splitterKeyEvent(k("ArrowRight"), 0, h)).toEqual({
      type: "STEP",
      handle: 0,
      direction: 1,
    })
    expect(splitterKeyEvent(k("ArrowLeft"), 0, { ...h, dir: "rtl" })).toEqual({
      type: "STEP",
      handle: 0,
      direction: 1,
    })
    expect(splitterKeyEvent(k("ArrowUp"), 0, h)).toBeNull()
    expect(splitterKeyEvent(k("ArrowUp"), 0, { ...h, orientation: "vertical" })).toEqual({
      type: "STEP",
      handle: 0,
      direction: -1,
    })
    expect(splitterKeyEvent(k("ArrowRight", { alt: true }), 0, h)).toBeNull()
    expect(splitterKeyEvent(k("Escape"), 0, h)).toBeNull()
    expect(splitterKeyEvent(k("Escape"), 0, { ...h, dragging: true })).toEqual({
      type: "DRAG.CANCEL",
    })
    expect(splitterKeyEvent(k("Enter", { repeat: true }), 0, h)).toBeNull()
  })
})
