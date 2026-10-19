// Image Cropper geometry: the matrix and its inverse, flip and rotation mapping (zag#3238),
// exact coverage under free rotation, the smallest covering zoom, move and resize limits,
// zoom around a point.
import { describe, expect, it } from "vitest"
import {
  apply,
  type CropPlacement,
  constrainPlacement,
  covers,
  cropData,
  defaultCrop,
  imageMatrix,
  invert,
  minCoverZoom,
  moveCrop,
  resizeCrop,
  zoomAt,
} from "./geometry"

// A 400 × 200 image in a 400 × 200 viewport: fit 1, the image fills the viewport.
const base: CropPlacement = {
  natural: { width: 400, height: 200 },
  viewport: { width: 400, height: 200 },
  zoom: 1,
  rotation: 0,
  flip: { horizontal: false, vertical: false },
  offset: { x: 0, y: 0 },
}
const limits = { minWidth: 40, minHeight: 40, maxWidth: Infinity, maxHeight: Infinity }
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)

describe("matrix", () => {
  it("identity placement maps natural to viewport 1:1 and inverts", () => {
    const m = imageMatrix(base)
    const p = apply(m, { x: 10, y: 20 })
    close(p.x, 10)
    close(p.y, 20)
    const back = apply(invert(m), p)
    close(back.x, 10)
    close(back.y, 20)
  })

  it("a horizontal flip maps the screen's left to the image's right (zag#3238)", () => {
    const flipped = { ...base, flip: { horizontal: true, vertical: false } }
    const r = cropData(flipped, { x: 0, y: 0, width: 100, height: 100 }).rect
    close(r.x, 300)
    close(r.width, 100)
  })

  it("rotation 90° maps the screen's top-left to the image's bottom-left region", () => {
    // A 200 × 200 image in a 200 × 200 viewport, rotated 90° clockwise.
    const sq = {
      ...base,
      natural: { width: 200, height: 200 },
      viewport: { width: 200, height: 200 },
      rotation: 90,
    }
    const r = cropData(sq, { x: 0, y: 0, width: 100, height: 100 }).rect
    close(r.x, 0)
    close(r.y, 100)
  })
})

describe("coverage", () => {
  it("free rotation at zoom 1 leaves corners outside; the minimum covering zoom fixes it", () => {
    const crop = defaultCrop(base.natural, base.viewport)
    const rotated = { ...base, rotation: 30 }
    expect(covers(rotated, crop)).toBe(false)
    const z = minCoverZoom(rotated, crop, 5)
    expect(z).toBeGreaterThan(1)
    const fixed = constrainPlacement(rotated, crop, 5)
    expect(covers(fixed, crop)).toBe(true)
    // The smallest: a little less does not cover at any offset.
    expect(covers(constrainPlacement({ ...rotated, zoom: z - 0.01 }, crop, z - 0.01), crop)).toBe(
      false,
    )
  })

  it("panning is clamped to the nearest covering offset", () => {
    const crop = defaultCrop(base.natural, base.viewport)
    const zoomed = { ...base, zoom: 2, offset: { x: 1000, y: 0 } }
    const p = constrainPlacement(zoomed, crop, 5)
    expect(covers(p, crop)).toBe(true)
    expect(p.offset.x).toBeLessThan(1000)
    expect(p.offset.y).toBe(0)
  })
})

describe("crops", () => {
  it("the default crop is 80 % of the image box, with the aspect", () => {
    const c = defaultCrop(base.natural, base.viewport, 1)
    close(c.width, 160)
    close(c.height, 160)
    close(c.x, 120)
  })

  it("moving stops at the image's edge", () => {
    const crop = { x: 100, y: 50, width: 100, height: 100 }
    const moved = moveCrop(base, crop, 1000, 0)
    close(moved.x, 300)
    close(moved.y, 50)
  })

  it("resizing keeps the opposite edge, the minimum and the aspect", () => {
    const crop = { x: 100, y: 50, width: 100, height: 100 }
    const smaller = resizeCrop(base, crop, "se", -90, -90, limits)
    close(smaller.width, 40)
    close(smaller.x, 100)
    const square = resizeCrop(base, crop, "e", 40, 0, { ...limits, aspect: 1 })
    close(square.width, 140)
    close(square.height, 140)
    expect(covers(base, square)).toBe(true)
  })

  it("resizing past the image stops at coverage", () => {
    const crop = { x: 100, y: 50, width: 100, height: 100 }
    const grown = resizeCrop(base, crop, "e", 1000, 0, limits)
    expect(grown.x + grown.width).toBeLessThanOrEqual(400.5)
    close(grown.x, 100)
  })
})

describe("zoomAt", () => {
  it("keeps the image point under the anchor", () => {
    const anchor = { x: 300, y: 50 }
    const before = apply(invert(imageMatrix(base)), anchor)
    const after = zoomAt(base, 2, anchor)
    const point = apply(imageMatrix(after), before)
    close(point.x, anchor.x)
    close(point.y, anchor.y)
  })
})
