// The grace polygon in Node (openspec add-tooltip, hover-intent "Grace Area" and "Placed
// Target"): pure geometry. The DOM behaviour is in hover-intent.browser.test.ts.
import { describe, expect, it } from "vitest"
import type { RectLike } from "../env/position"
import { gracePolygon, pointInPolygon } from "./hover-intent"

const rect = (left: number, top: number, width: number, height: number): RectLike => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
})
const inside = (poly: readonly { x: number; y: number }[], x: number, y: number) =>
  pointInPolygon({ x, y }, poly)

describe("pointInPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]

  it("points inside and outside a convex polygon", () => {
    expect(inside(square, 5, 5)).toBe(true)
    expect(inside(square, 0.1, 0.1)).toBe(true)
    expect(inside(square, 11, 5)).toBe(false)
    expect(inside(square, 5, -1)).toBe(false)
    expect(inside(square, -1, -1)).toBe(false)
  })

  it("is orientation independent", () => {
    const reversed = [...square].reverse()
    expect(inside(reversed, 5, 5)).toBe(true)
    expect(inside(reversed, 15, 5)).toBe(false)
  })

  it("handles a concave polygon", () => {
    // An L shape: the notch at the top right is outside.
    const l = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(inside(l, 2, 2)).toBe(true)
    expect(inside(l, 8, 8)).toBe(true)
    expect(inside(l, 8, 2)).toBe(false)
  })

  it("an empty or degenerate polygon contains nothing", () => {
    expect(inside([], 1, 1)).toBe(false)
    expect(inside([{ x: 0, y: 0 }], 0, 0)).toBe(false)
    expect(
      inside(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        5,
        5,
      ),
    ).toBe(false)
  })
})

describe("gracePolygon", () => {
  // A trigger and a card placed 8 px above it.
  const trigger = rect(100, 100, 40, 20)
  const card = rect(80, 60, 80, 32) // bottom 92: an 8 px gap

  it("is a convex polygon of the padded exit point and the target's corners", () => {
    const poly = gracePolygon({ x: 120, y: 100 }, trigger, card)
    expect(poly.length).toBeGreaterThanOrEqual(4)
    expect(poly.length).toBeLessThanOrEqual(6)
    // the exit point itself, and all four corners of the target, are inside or on it
    expect(inside(poly, 120, 98)).toBe(true)
    for (const [x, y] of [
      [81, 61],
      [159, 61],
      [159, 91],
      [81, 91],
    ] as const)
      expect(inside(poly, x, y), `${x},${y}`).toBe(true)
  })

  it("covers the gap between trigger and card (gap scenario)", () => {
    const poly = gracePolygon({ x: 120, y: 100 }, trigger, card)
    for (let y = 93; y <= 99; y++) expect(inside(poly, 120, y), `y=${y}`).toBe(true)
    // slightly off the straight line, still in transit
    expect(inside(poly, 112, 96)).toBe(true)
    expect(inside(poly, 128, 96)).toBe(true)
  })

  it("is padded on both sides of the exit direction", () => {
    const poly = gracePolygon({ x: 120, y: 100 }, trigger, card)
    expect(inside(poly, 117, 101)).toBe(true)
    expect(inside(poly, 123, 101)).toBe(true)
  })

  it("does not include the pointer moving away from the card", () => {
    const poly = gracePolygon({ x: 120, y: 100 }, trigger, card)
    expect(inside(poly, 120, 130)).toBe(false)
    expect(inside(poly, 120, 125)).toBe(false)
  })

  it("is not the hull of both rectangles: a neighbour beside the trigger is outside", () => {
    const poly = gracePolygon({ x: 120, y: 100 }, trigger, card)
    // 20 px to the right of the trigger, level with it
    expect(inside(poly, 160, 110)).toBe(false)
    expect(inside(poly, 70, 110)).toBe(false)
    // below the trigger
    expect(inside(poly, 120, 140)).toBe(false)
  })

  it("exit through the card's side towards the trigger: the target is the trigger", () => {
    const poly = gracePolygon({ x: 120, y: 92 }, card, trigger)
    expect(inside(poly, 120, 96)).toBe(true)
    expect(inside(poly, 120, 50)).toBe(false)
  })

  it("works for every exit side", () => {
    // trigger exit on the left, card placed to the left
    const left = gracePolygon({ x: 100, y: 110 }, trigger, rect(40, 90, 52, 40))
    expect(inside(left, 96, 110)).toBe(true)
    expect(inside(left, 120, 110)).toBe(false)
    // right
    const right = gracePolygon({ x: 140, y: 110 }, trigger, rect(148, 90, 52, 40))
    expect(inside(right, 144, 110)).toBe(true)
    expect(inside(right, 120, 110)).toBe(false)
    // bottom
    const bottom = gracePolygon({ x: 120, y: 120 }, trigger, rect(80, 128, 80, 32))
    expect(inside(bottom, 120, 124)).toBe(true)
    expect(inside(bottom, 120, 90)).toBe(false)
  })

  it("uses the placed target as given: a card flipped to the left of its trigger", () => {
    // Requested on the right, placed on the left (submenu flipped); the pointer moves left.
    const flipped = rect(20, 90, 60, 60)
    const poly = gracePolygon({ x: 100, y: 110 }, trigger, flipped)
    expect(inside(poly, 90, 110)).toBe(true)
    expect(inside(poly, 60, 120)).toBe(true)
    // the (unplaced) right side is not covered
    expect(inside(poly, 160, 110)).toBe(false)
  })

  it("a wide card does not keep the layer open while the pointer moves to a neighbour (reka-ui#2203)", () => {
    // Trigger 40 wide, card 600 wide centred above it; the pointer leaves the trigger to the
    // right, towards a neighbouring link level with the trigger.
    const wide = rect(-180, 60, 600, 32)
    const poly = gracePolygon({ x: 140, y: 110 }, trigger, wide)
    expect(inside(poly, 150, 110)).toBe(false)
    expect(inside(poly, 160, 110)).toBe(false)
  })

  it("an exit near a corner, moving towards the target, counts the side facing it (radix#4036)", () => {
    // A flick from a full-width trigger down-left into a submenu flipped to its left: the
    // exit point is at the bottom-left corner, nearer the bottom side than the left one.
    const flipped = rect(20, 100, 80, 60)
    const left = { dx: -2, dy: 0.3 }
    // Out through the bottom, 5 px from the corner, moving left: the left side counts.
    const poly = gracePolygon({ x: 105, y: 120 }, trigger, flipped, left)
    expect(poly.length).toBeGreaterThan(0)
    expect(inside(poly, 103, 121)).toBe(true)
    // Moving right (away from the card), or with no motion known: no grace area.
    expect(gracePolygon({ x: 105, y: 120 }, trigger, flipped, { dx: 2, dy: 0.3 })).toEqual([])
    expect(gracePolygon({ x: 105, y: 120 }, trigger, flipped)).toEqual([])
  })

  it("a pointer jumping far past the polygon is outside it", () => {
    const poly = gracePolygon({ x: 120, y: 100 }, trigger, card)
    expect(inside(poly, 500, 500)).toBe(false)
    expect(inside(poly, -500, 60)).toBe(false)
  })
})
