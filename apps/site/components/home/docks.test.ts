import { describe, expect, it } from "vitest"
import { arc, fit, hop, locate } from "./docks"

// Node has no DOMRect: the geometry only needs its fields and constructor
class Rect {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly width = 0,
    readonly height = 0,
  ) {}
}
globalThis.DOMRect ??= Rect as unknown as typeof DOMRect // the four fields docks.ts reads

const box = (x: number, y: number, w = 100, h = 50) => new DOMRect(x, y, w, h)

describe("locate", () => {
  it("is nowhere before the first dock is left", () => {
    expect(
      locate(
        [
          { box: box(0, 0), rest: 0, gone: -10 },
          { box: box(0, 500), rest: 300, gone: -400 },
        ],
        9999,
      ),
    ).toBeNull()
  })
  it("shares the flight between the distance gone and the distance left", () => {
    const p = locate(
      [
        { box: box(0, 0), rest: 0, gone: 100 },
        { box: box(0, 500), rest: 300, gone: -400 },
      ],
      9999,
    )
    expect(p).toEqual({ from: 0, to: 1, t: 0.25, past: 0 })
  })
  it("is on the next dock once its arrival line is passed, counting the scroll since", () => {
    const p = locate(
      [
        { box: box(0, 0), rest: 0, gone: 400 },
        { box: box(0, 500), rest: -40, gone: -10 },
      ],
      9999,
    )
    expect(p).toEqual({ from: 0, to: 1, t: 1, past: 40 })
  })
  it("ends a flight at the page's foot when the last dock sits too low to reach its line", () => {
    const p = locate(
      [
        { box: box(0, 0), rest: 0, gone: 300 },
        { box: box(0, 900), rest: 200, gone: -500 },
      ],
      0,
    )
    expect(p?.t).toBe(1)
  })
  it("takes the latest flight under way and skips a dock that is not on the page", () => {
    const docks = [
      { box: box(0, 0), rest: -900, gone: 800 },
      { box: null, rest: 0, gone: 0 },
      { box: box(0, 0), rest: -200, gone: 50 },
      { box: box(0, 600), rest: 150, gone: -300 },
    ]
    expect(locate(docks, 9999)).toMatchObject({ from: 2, to: 3, t: 0.25 })
  })
})

describe("arc", () => {
  it("starts and ends exactly on its boxes", () => {
    expect(arc(box(0, 0), box(400, 400), 0, 100)).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    })
    expect(arc(box(0, 0), box(400, 400), 1, 100)).toMatchObject({ x: 400, y: 400 })
  })
  it("is lifted and never a speck at its middle", () => {
    const mid = arc(box(0, 400, 20, 10), box(400, 400, 20, 10), 0.5, 100)
    expect(mid.y + mid.height / 2).toBeCloseTo(305)
    expect(Math.max(mid.width, mid.height)).toBeCloseTo(72)
  })
})

describe("hop", () => {
  it("is drawn whole on each dock and not at all half-way", () => {
    expect(hop(box(0, 0), box(0, 500), 0).alpha).toBe(1)
    expect(hop(box(0, 0), box(0, 500), 0.5).alpha).toBe(0)
    expect(hop(box(0, 0), box(0, 500), 1)).toMatchObject({ alpha: 1, box: { y: 500, width: 100 } })
  })
})

describe("fit", () => {
  it("centres the object's own proportions in a room", () => {
    expect(fit(box(0, 0, 200, 200), 2, 1)).toMatchObject({ x: 0, y: 50, width: 200, height: 100 })
  })
})
