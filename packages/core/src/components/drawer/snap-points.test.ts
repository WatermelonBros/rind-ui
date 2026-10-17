// Drawer snap points (openspec add-drawer, "Snap Points" and "Swipe To Dismiss"): pure Node tests.
import { describe, expect, it } from "vitest"
import type { SwipeDirection, SwipeRelease } from "../../dom/swipe"
import {
  cycle,
  type ResolvedSnapPoint,
  resolveSnapPoints,
  type SnapPoint,
  settleTarget,
  swipeDismisses,
} from "./snap-points"

const sizes = { content: 600, viewport: 800, rootFontSize: 16 }
const rel = (over: Partial<SwipeRelease> = {}): SwipeRelease => ({
  direction: "down",
  offset: 0,
  velocity: 0,
  size: 600,
  ...over,
})
const resolve = (points: SnapPoint[], s = sizes) => resolveSnapPoints(points, s)
const sizesOf = (points: SnapPoint[], s = sizes) => resolve(points, s).map((r) => r.size)

describe("resolveSnapPoints", () => {
  it("resolves fractions of the viewport, px numbers, px and rem strings", () => {
    expect(sizesOf([0.25])).toEqual([200])
    expect(sizesOf([250])).toEqual([250])
    expect(sizesOf(["300px"])).toEqual([300])
    expect(sizesOf(["10rem"])).toEqual([160])
    expect(sizesOf(["10rem"], { ...sizes, rootFontSize: 20 })).toEqual([200])
  })
  it("treats 0 and 1 as fractions", () => {
    expect(sizesOf([0, 1])).toEqual([0, 600])
    expect(sizesOf([1], { ...sizes, content: 900 })).toEqual([800])
  })
  it("clamps to the content size and the viewport", () => {
    expect(sizesOf([1, "900px", 9999])).toEqual([600])
    expect(sizesOf([1], { content: 900, viewport: 700, rootFontSize: 16 })).toEqual([700])
    expect(sizesOf(["-5px"])).toEqual([0])
  })
  it("offset is content size minus size", () => {
    expect(resolve([0.25, 1]).map((r) => r.offset)).toEqual([400, 0])
  })
  it("orders by size whatever the order given (vaul#616)", () => {
    expect(resolve([1, 0.4]).map((r) => r.point)).toEqual(resolve([0.4, 1]).map((r) => r.point))
    expect(sizesOf([1, 0.4])).toEqual([320, 600])
  })
  it("dedupes within 1 px, keeping the first given", () => {
    const r = resolve(["300px", 300.5, "299.5px"])
    expect(r.map((x) => x.point)).toEqual(["300px"])
    expect(sizesOf([0.5, 0.75, "400.5px"])).toEqual([400, 600])
    // exactly 1 px apart is two points
    expect(sizesOf(["300px", "301px"])).toEqual([300, 301])
  })
  it("dedupes points that clamp to the same size", () => {
    expect(resolve(["700px", 1]).map((x) => x.point)).toEqual(["700px"])
  })
  it("re-resolves when the viewport changes (vaul#284)", () => {
    expect(sizesOf([0.5], { content: 900, viewport: 800, rootFontSize: 16 })).toEqual([400])
    expect(sizesOf([0.5], { content: 900, viewport: 360, rootFontSize: 16 })).toEqual([180])
  })
  it("returns nothing for no points", () => {
    expect(resolve([])).toEqual([])
  })
})

const edge: SwipeDirection = "down"
const opts = { edge, closeOnSwipe: true, swipeThreshold: 0.5, swipeVelocityThreshold: 0.5 }

describe("swipeDismisses", () => {
  it("closes at half the size", () => {
    expect(swipeDismisses(rel({ offset: 300 }), opts)).toBe(true)
    expect(swipeDismisses(rel({ offset: 299 }), opts)).toBe(false)
  })
  it("closes at the velocity threshold", () => {
    expect(swipeDismisses(rel({ offset: 20, velocity: 0.5 }), opts)).toBe(true)
    expect(swipeDismisses(rel({ offset: 20, velocity: 0.49 }), opts)).toBe(false)
  })
  it("honours a custom threshold", () => {
    expect(swipeDismisses(rel({ offset: 100 }), { ...opts, swipeThreshold: 0.1 })).toBe(true)
  })
  it("never closes without a direction or toward another direction", () => {
    expect(swipeDismisses(rel({ direction: null, offset: 500, velocity: 5 }), opts)).toBe(false)
    expect(swipeDismisses(rel({ direction: "up", offset: 500, velocity: 5 }), opts)).toBe(false)
    expect(swipeDismisses(rel({ direction: "left", offset: 500, velocity: 5 }), opts)).toBe(false)
  })
  it("never closes with closeOnSwipe false", () => {
    expect(
      swipeDismisses(rel({ offset: 500, velocity: 5 }), { ...opts, closeOnSwipe: false }),
    ).toBe(false)
  })

  describe("with snap points", () => {
    const resolved = resolve([0.25, 0.5, 1]) // 200, 400, 600
    const at = (current: SnapPoint) => ({ resolved, current })
    it("does not close while the projection stays above the smallest point", () => {
      expect(swipeDismisses(rel({ offset: 150 }), opts, at(1))).toBe(false)
      expect(swipeDismisses(rel({ offset: 350 }), opts, at(1))).toBe(false)
    })
    it("closes a slow drag only well below the smallest point", () => {
      expect(swipeDismisses(rel({ offset: 50 }), opts, at(0.25))).toBe(false)
      expect(swipeDismisses(rel({ offset: 99 }), opts, at(0.25))).toBe(false)
      expect(swipeDismisses(rel({ offset: 101 }), opts, at(0.25))).toBe(true)
    })
    it("projects the velocity 300 ms ahead", () => {
      // from 0.5 (400): 100 + 0.5 * 300 = 250 -> 150 left, above 100
      expect(swipeDismisses(rel({ offset: 100, velocity: 0.5 }), opts, at(0.5))).toBe(false)
      expect(swipeDismisses(rel({ offset: 100, velocity: 1.0 }), opts, at(0.5))).toBe(true)
    })
    it("a flick down from the top point does not close a three-point drawer when slow", () => {
      expect(swipeDismisses(rel({ offset: 200, velocity: 0.1 }), opts, at(1))).toBe(false)
    })
    it("closeOnSwipe false never closes", () => {
      expect(
        swipeDismisses(
          rel({ offset: 500, velocity: 5 }),
          { ...opts, closeOnSwipe: false },
          at(0.25),
        ),
      ).toBe(false)
    })
    it("a stale current point counts as fully open", () => {
      expect(swipeDismisses(rel({ offset: 300 }), opts, at(0.33))).toBe(false)
    })
    it("a swipe away from the edge never closes", () => {
      expect(
        swipeDismisses(rel({ direction: "up", offset: 500, velocity: 5 }), opts, at(0.25)),
      ).toBe(false)
    })
  })

  it("works for a top-edge drawer", () => {
    const top = { ...opts, edge: "up" as const }
    expect(swipeDismisses(rel({ direction: "up", offset: 300 }), top)).toBe(true)
    expect(swipeDismisses(rel({ direction: "down", offset: 300 }), top)).toBe(false)
  })
})

describe("settleTarget", () => {
  const resolved = resolve([0.25, 0.5, 1]) // 200, 400, 600
  const base = { edge, sequential: false, swipeVelocityThreshold: 0.5 }
  const pointOf = (r: ResolvedSnapPoint | undefined) => r?.point
  const at = (current: SnapPoint) => ({ resolved, current })
  const up = (offset: number, velocity = 0) => rel({ direction: "up", offset, velocity })

  it("stays put without a direction or on the cross axis", () => {
    expect(pointOf(settleTarget(rel({ direction: null }), base, at(0.5)))).toBe(0.5)
    expect(pointOf(settleTarget(rel({ direction: "left", offset: 400 }), base, at(0.5)))).toBe(0.5)
  })
  it("settles on the closest point to the dragged position", () => {
    expect(pointOf(settleTarget(up(150), base, at(0.25)))).toBe(0.5) // 350 -> 400
    expect(pointOf(settleTarget(up(90), base, at(0.25)))).toBe(0.25) // 290 -> 200 vs 400: 290 closer to 200? 90 vs 110
  })
  it("projects the velocity: a flick skips a point (vaul#333)", () => {
    // 200 + 20 + 1.5 * 300 = 670 -> 600
    expect(pointOf(settleTarget(up(20, 1.5), base, at(0.25)))).toBe(1)
  })
  it("sequential moves one point with the same flick (vaul#333)", () => {
    expect(pointOf(settleTarget(up(20, 1.5), { ...base, sequential: true }, at(0.25)))).toBe(0.5)
  })
  it("sequential ignores a tiny drag and moves on distance or velocity", () => {
    const s = { ...base, sequential: true }
    expect(pointOf(settleTarget(up(5, 0.1), s, at(0.25)))).toBe(0.25)
    expect(pointOf(settleTarget(up(11, 0), s, at(0.25)))).toBe(0.5)
    expect(pointOf(settleTarget(up(2, 0.5), s, at(0.25)))).toBe(0.5)
  })
  it("sequential never goes past the ends", () => {
    const s = { ...base, sequential: true }
    expect(pointOf(settleTarget(up(300, 2), s, at(1)))).toBe(1)
    expect(pointOf(settleTarget(rel({ offset: 300, velocity: 2 }), s, at(0.25)))).toBe(0.25)
  })
  it("dragging toward the edge settles on a smaller point", () => {
    expect(pointOf(settleTarget(rel({ offset: 150 }), base, at(1)))).toBe(0.5) // 450 -> 400
    expect(pointOf(settleTarget(rel({ offset: 10, velocity: 1.2 }), base, at(1)))).toBe(0.25) // 230
    expect(pointOf(settleTarget(rel({ offset: 20 }), { ...base, sequential: true }, at(1)))).toBe(
      0.5,
    )
  })
  it("is the same for unsorted input (vaul#616)", () => {
    const unsorted = { resolved: resolve([1, 0.25, 0.5]), current: 0.25 }
    expect(pointOf(settleTarget(up(350), base, unsorted))).toBe(1)
  })
  it("a stale current point counts as fully open; empty list gives nothing", () => {
    expect(pointOf(settleTarget(rel({ offset: 10 }), base, at(0.33)))).toBe(1)
    expect(settleTarget(rel(), base, { resolved: [], current: 1 })).toBeUndefined()
  })
  it("a horizontal side works with its own edge", () => {
    const right = { ...base, edge: "right" as const }
    expect(pointOf(settleTarget(rel({ direction: "left", offset: 350 }), right, at(0.25)))).toBe(1)
  })
})

describe("cycle", () => {
  const resolved = resolve([0.4, 1])
  it("moves to the next larger point and wraps to the first", () => {
    expect(cycle(resolved, 0.4)?.point).toBe(1)
    expect(cycle(resolved, 1)?.point).toBe(0.4)
  })
  it("advances once per press, 20 presses in a row (vaul#364)", () => {
    let current: SnapPoint = 0.4
    for (let i = 0; i < 20; i++) current = cycle(resolved, current)?.point ?? current
    expect(current).toBe(0.4)
    let three: SnapPoint = 0.25
    const r3 = resolve([0.25, 0.5, 1])
    for (let i = 0; i < 20; i++) three = cycle(r3, three)?.point ?? three
    expect(three).toBe(1) // 20 mod 3 = 2
  })
  it("starts from the first for an unknown point; nothing for no points", () => {
    expect(cycle(resolved, 0.7)?.point).toBe(0.4)
    expect(cycle([], 1)).toBeUndefined()
  })
  it("a single point cycles to itself", () => {
    expect(cycle(resolve([0.5]), 0.5)?.point).toBe(0.5)
  })
})
