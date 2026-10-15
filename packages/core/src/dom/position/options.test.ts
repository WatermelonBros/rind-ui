import { describe, expect, it } from "vitest"
import type { PositioningProps } from "../../env/position"
import {
  paddingOf,
  physicalSide,
  placementOf,
  positioningPresets,
  resolvePositioning,
  snap,
} from "./options"

describe("presets (design §4)", () => {
  const flip = { side: "flip", align: "flip", fallbackAxis: "end" }
  const shiftAlign = { side: "flip", align: "shift", fallbackAxis: "none" }
  const rows = [
    ["popup", "bottom", "center", flip, "none", "auto"],
    ["dropdown", "bottom", "start", shiftAlign, "open", "auto"],
    ["submenu", "inline-end", "start", shiftAlign, "none", "auto"],
    [
      "pointer",
      "right",
      "start",
      { side: "flip", align: "flip", fallbackAxis: "none" },
      "none",
      "none",
    ],
  ] as const
  it.each(rows)("%s", (name, side, align, avoidance, sideLock, tracking) => {
    const p = positioningPresets[name]
    expect(p.side).toBe(side)
    expect(p.align).toBe(align)
    expect(p.collisionAvoidance).toEqual(avoidance)
    expect(p.sideLock).toBe(sideLock)
    expect(p.tracking).toBe(tracking === "none" ? "none" : "auto")
    expect(p.collisionPadding).toBe(8)
    expect(p.strategy).toBe("auto")
  })
})

describe("resolvePositioning", () => {
  const d = positioningPresets.popup
  it("returns the defaults without props", () => {
    expect(resolvePositioning(undefined, d)).toBe(d)
  })
  it("consumer props override, undefined is ignored, defaults stay untouched", () => {
    // exactOptionalPropertyTypes forbids an explicit undefined; JS callers can still pass one.
    const withUndefined = {
      side: "top",
      sideOffset: 4,
      align: undefined,
    } as unknown as PositioningProps
    const r = resolvePositioning(withUndefined, d)
    expect(r.side).toBe("top")
    expect(r.sideOffset).toBe(4)
    expect(r.align).toBe("center")
    expect(d.side).toBe("bottom")
    expect(d.sideOffset).toBe(0)
  })
})

describe("physicalSide", () => {
  it.each([
    ["inline-start", "ltr", "left"],
    ["inline-end", "ltr", "right"],
    ["inline-start", "rtl", "right"],
    ["inline-end", "rtl", "left"],
    ["top", "rtl", "top"],
    ["bottom", "ltr", "bottom"],
    ["left", "rtl", "left"],
    ["right", "rtl", "right"],
  ] as const)("%s in %s is %s", (side, dir, expected) => {
    expect(physicalSide(side, dir)).toBe(expected)
  })
})

describe("placementOf / paddingOf / snap", () => {
  it("placementOf omits the centre alignment", () => {
    expect(placementOf("top", "center")).toBe("top")
    expect(placementOf("left", "end")).toBe("left-end")
  })
  it("paddingOf expands a number and fills missing sides with 0", () => {
    expect(paddingOf(8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8 })
    expect(paddingOf({ top: 2, left: 5 })).toEqual({ top: 2, right: 0, bottom: 0, left: 5 })
  })
  it("snap rounds to the device pixel grid", () => {
    expect(snap(10.3, 1.25)).toBeCloseTo(10.4, 10)
    expect(snap(10.3, 1)).toBe(10)
    expect(snap(10.3, 2)).toBe(10.5)
  })
})
