import { describe, expect, it } from "vitest"
import { clamp, decimals, gridMax, roundToStepPrecision, snap } from "./step-math"

describe("step-math", () => {
  it("counts decimals, exponent notation included", () => {
    expect(decimals(1)).toBe(0)
    expect(decimals(0.1)).toBe(1)
    expect(decimals(0.25)).toBe(2)
    expect(decimals(1e-7)).toBe(7)
    expect(decimals(1.5e-3)).toBe(4)
    expect(decimals(1e21)).toBe(0)
    expect(decimals(Number.NaN)).toBe(0)
  })

  it("snaps without float drift (BU#4547, BITS#1518)", () => {
    expect(snap(0.2 + 0.1, 0.1)).toBe(0.3)
    expect(snap(0.7 + 0.1, 0.1)).toBe(0.8)
    expect(roundToStepPrecision(1.1 * 3, 0.1)).toBe(3.3)
  })

  it("snaps tiny steps to their decimals (RX#3852)", () => {
    const v = snap(0.123456789, 1e-7)
    expect(v).toBe(0.1234568)
    expect(decimals(v)).toBeLessThanOrEqual(7)
  })

  it("snaps relative to min", () => {
    expect(snap(4, 3, 1)).toBe(4)
    expect(snap(5, 3, 1)).toBe(4)
    expect(snap(5.6, 3, 1)).toBe(7)
    expect(snap(0.35, 0.1, 0.05)).toBe(0.35)
  })

  it("finds the highest reachable grid value", () => {
    expect(gridMax(0, 10, 3)).toBe(9)
    expect(gridMax(0, 100, 1)).toBe(100)
    expect(gridMax(0, 1, 0.1)).toBe(1)
    expect(gridMax(0, 0.3, 0.1)).toBe(0.3)
  })

  it("clamps", () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-1, 0, 100)).toBe(0)
  })
})
