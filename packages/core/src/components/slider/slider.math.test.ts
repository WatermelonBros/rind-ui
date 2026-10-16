import { describe, expect, it, vi } from "vitest"
import {
  fractionOf,
  keyTarget,
  normalizeValues,
  pickThumb,
  settle,
  sliderRange,
  stackPick,
  thumbBounds,
  valueAt,
} from "./slider.math"

const r = sliderRange({})

describe("slider math", () => {
  it("defaults: 0 to 100 by 1, large step one tenth", () => {
    expect(r).toEqual({ min: 0, max: 100, top: 100, step: 1, largeStep: 10, gap: 0 })
    expect(sliderRange({ max: 1, step: 0.01 }).largeStep).toBe(0.1)
    expect(sliderRange({ max: 5 }).largeStep).toBe(1)
  })

  it("steps without drift (BU#4547, BITS#1518)", () => {
    const tenth = sliderRange({ max: 1, step: 0.1 })
    const next = keyTarget("INCREASE", [0.2], 0, tenth, false)
    expect(settle([0.2], 0, next, tenth).values).toEqual([0.3])
  })

  it("keeps tiny steps on their grid (RX#3852)", () => {
    const tiny = sliderRange({ max: 0.001, step: 1e-7 })
    const v = valueAt(0.3333333333, tiny)
    expect(v).toBe(0.0003333)
  })

  it("clamps a large step at the end (ZG#2504)", () => {
    const big = sliderRange({ largeStep: 10 })
    expect(settle([95], 0, keyTarget("INCREASE", [95], 0, big, true), big).values).toEqual([100])
  })

  it("an off-grid max stops at the last grid value, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const off = sliderRange({ min: 0, max: 10, step: 3 })
    expect(off.top).toBe(9)
    expect(settle([3], 0, keyTarget("LAST", [3], 0, off, false), off).values).toEqual([9])
    expect(warn.mock.calls.flat().join(" ")).toMatch(/max 10 is not reachable/)
    warn.mockRestore()
  })

  it("min >= max is an error and puts every thumb at min", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const empty = sliderRange({ min: 5, max: 5 })
    expect(normalizeValues([1, 9], empty)).toEqual([5, 5])
    expect(fractionOf(5, empty)).toBe(0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it("normalises out-of-range and unsorted values (RA#4978)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(normalizeValues([150], r, "value")).toEqual([100])
    expect(normalizeValues([80, 20.4], r, "value")).toEqual([20, 80])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("enforces the gap at creation (ZG#2488)", () => {
    const gapped = sliderRange({ minStepsBetweenThumbs: 5 })
    expect(normalizeValues([50, 52], gapped)).toEqual([50, 55])
    expect(normalizeValues([98, 99], gapped)).toEqual([95, 100])
  })

  it("neighbour bounds with a gap", () => {
    const gapped = sliderRange({ minStepsBetweenThumbs: 5 })
    expect(thumbBounds([20, 60], 0, gapped)).toEqual([0, 55])
    expect(thumbBounds([20, 60], 1, gapped)).toEqual([25, 100])
  })

  it("stop keeps a thumb at its neighbour", () => {
    expect(settle([20, 21], 0, 23, r).values).toEqual([21, 21])
  })

  it("push moves the neighbours along", () => {
    expect(settle([20, 60], 0, 70, r, "push").values).toEqual([70, 70])
    const gapped = sliderRange({ minStepsBetweenThumbs: 5 })
    expect(settle([20, 60, 90], 0, 100, gapped, "push").values).toEqual([90, 95, 100])
  })

  it("swap passes the neighbour and reports the new index (RX#730)", () => {
    expect(settle([20, 60], 0, 70, r, "swap")).toEqual({ values: [60, 70], index: 1 })
    expect(settle([20, 60], 1, 10, r, "swap")).toEqual({ values: [10, 20], index: 0 })
    // Within the gap of the neighbour it stops at the bound instead.
    const gapped = sliderRange({ minStepsBetweenThumbs: 5 })
    expect(settle([20, 60], 0, 62, gapped, "swap")).toEqual({ values: [55, 60], index: 0 })
  })

  it("picks the nearest enabled thumb (RA#942)", () => {
    expect(pickThumb([20, 80], 70, () => true)).toBe(1)
    expect(pickThumb([20, 80], 10, (i) => i !== 0)).toBe(1)
    expect(pickThumb([20, 80], 10, () => false)).toBeNull()
  })

  it("on a stack, picks by direction or defers (BU#1602, RA#6408)", () => {
    expect(pickThumb([100, 100], 100, () => true)).toBe("stack")
    expect(pickThumb([100, 100], 90, () => true)).toBe(0)
    expect(pickThumb([0, 0], 10, () => true)).toBe(1)
    expect(stackPick([0, 1], 100, 95)).toBe(0)
  })

  it("maps fractions to values", () => {
    expect(valueAt(0.75, r)).toBe(75)
    expect(valueAt(1.2, r)).toBe(100)
    expect(fractionOf(25, r)).toBe(0.25)
  })
})
