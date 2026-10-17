// add-scroll-area 2.2: the range normalisation and wheel clamping (pure); the DOM half is in
// the browser tests (packages/testing/src/components/scroll-area.browser.test.tsx).
import { describe, expect, it } from "vitest"
import { isReversed, physicalFraction, wheelTarget } from "./scroll-metrics"

describe("scroll range", () => {
  it("reversed axes: RTL XOR row-reverse; column-reverse", () => {
    expect(isReversed("x", "rtl", "row")).toBe(true)
    expect(isReversed("x", "rtl", "row-reverse")).toBe(false)
    expect(isReversed("x", "ltr", "row-reverse")).toBe(true)
    expect(isReversed("y", "rtl", "row")).toBe(false)
    expect(isReversed("y", "ltr", "column-reverse")).toBe(true)
  })
  it("physical fraction from the top / left, never NaN", () => {
    expect(physicalFraction({ pos: 0, min: 0, max: 100 })).toBe(0)
    expect(physicalFraction({ pos: 100, min: 0, max: 100 })).toBe(1)
    // RTL at its start (scrollLeft 0): the thumb sits at the right.
    expect(physicalFraction({ pos: 0, min: -100, max: 100 })).toBe(1)
    expect(physicalFraction({ pos: -100, min: -100, max: 100 })).toBe(0)
    expect(physicalFraction({ pos: 0, min: 0, max: 0 })).toBe(0)
    expect(physicalFraction({ pos: 500, min: 0, max: 100 })).toBe(1)
  })
  it("wheel target is clamped to the range", () => {
    expect(wheelTarget({ pos: 90, min: 0, max: 100 }, 50)).toBe(100)
    expect(wheelTarget({ pos: 100, min: 0, max: 100 }, 50)).toBe(100)
    expect(wheelTarget({ pos: -10, min: -100, max: 100 }, 50)).toBe(0)
  })
})
