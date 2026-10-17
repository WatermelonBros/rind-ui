// add-tour 1.1: every "Spotlight And Backdrop" geometry scenario, on the pure function.
import { describe, expect, it } from "vitest"
import { cutoutsFor, spotlightPath } from "./spotlight-path"

const viewport = { width: 1000, height: 800 }
const defaults = { viewport, padding: { x: 8, y: 8 }, radius: 8 }

describe("cutoutsFor", () => {
  it("pads the target: a 100 × 40 box at (200, 300) leaves 116 × 56 at (192, 292)", () => {
    const target = { x: 200, y: 300, width: 100, height: 40 }
    expect(cutoutsFor({ ...defaults, target })).toEqual([
      { x: 192, y: 292, width: 116, height: 56, radius: 8 },
    ])
  })

  it("a centred step (no target) has no cutout, even with a card", () => {
    const content = { x: 400, y: 300, width: 200, height: 100 }
    expect(cutoutsFor({ ...defaults, content, contentCutout: { padding: 6, radius: 12 } })).toEqual(
      [],
    )
  })

  it("a card inside the target is merged into one hole (no even-odd cancelling)", () => {
    const target = { x: 100, y: 100, width: 600, height: 400 }
    const content = { x: 300, y: 200, width: 200, height: 100 }
    const out = cutoutsFor({
      ...defaults,
      target,
      content,
      contentCutout: { padding: 6, radius: 12 },
    })
    expect(out).toEqual([{ x: 92, y: 92, width: 616, height: 416, radius: 12 }])
  })

  it("a card beside the target keeps two holes", () => {
    const target = { x: 100, y: 100, width: 100, height: 40 }
    const content = { x: 100, y: 300, width: 200, height: 100 }
    const out = cutoutsFor({
      ...defaults,
      target,
      content,
      contentCutout: { padding: 6, radius: 12 },
    })
    expect(out).toHaveLength(2)
  })

  it("a target larger than the viewport is clamped to it", () => {
    const target = { x: -50, y: -50, width: 3000, height: 3000 }
    expect(cutoutsFor({ ...defaults, target })).toEqual([
      { x: 0, y: 0, width: 1000, height: 800, radius: 8 },
    ])
  })

  it("a 6 × 6 target with padding 0 and radius 8 gets radius 3", () => {
    const target = { x: 10, y: 10, width: 6, height: 6 }
    const out = cutoutsFor({ ...defaults, padding: { x: 0, y: 0 }, target })
    expect(out).toEqual([{ x: 10, y: 10, width: 6, height: 6, radius: 3 }])
    expect(spotlightPath(viewport, out)).not.toMatch(/NaN|-/)
  })

  it("a zero-area target (or one fully outside the viewport) has no cutout", () => {
    expect(
      cutoutsFor({
        ...defaults,
        padding: { x: 0, y: 0 },
        target: { x: 5, y: 5, width: 0, height: 0 },
      }),
    ).toEqual([])
    expect(cutoutsFor({ ...defaults, target: { x: 2000, y: 10, width: 50, height: 50 } })).toEqual(
      [],
    )
  })

  it("separate x and y padding", () => {
    const target = { x: 100, y: 100, width: 10, height: 10 }
    expect(cutoutsFor({ ...defaults, padding: { x: 4, y: 2 }, radius: 0, target })).toEqual([
      { x: 96, y: 98, width: 18, height: 14, radius: 0 },
    ])
  })
})

describe("spotlightPath", () => {
  it("starts with the viewport rectangle and adds one subpath per cutout", () => {
    expect(spotlightPath(viewport, [])).toBe("M0 0H1000V800H0Z")
    const path = spotlightPath(viewport, [{ x: 192, y: 292, width: 116, height: 56, radius: 8 }])
    expect(path.startsWith("M0 0H1000V800H0Z")).toBe(true)
    expect(path.match(/M/g)).toHaveLength(2)
    expect(path).toContain("M200 292H300A8 8 0 0 1 308 300")
  })

  it("a square cutout uses straight edges only", () => {
    const path = spotlightPath(viewport, [{ x: 1, y: 2, width: 3, height: 4, radius: 0 }])
    expect(path).toBe("M0 0H1000V800H0ZM1 2H4V6H1Z")
  })
})
