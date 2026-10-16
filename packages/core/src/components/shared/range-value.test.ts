import { afterEach, describe, expect, it, vi } from "vitest"
import { rangeValueAttributes, rangeValueText, resolveRangeValue } from "./range-value"

afterEach(() => vi.restoreAllMocks())

const text = (r: ReturnType<typeof resolveRangeValue>, formatOptions?: Intl.NumberFormatOptions) =>
  rangeValueText(r, { locale: "en-US", formatOptions }, ({ formatted }) => formatted)

describe("range-value", () => {
  it("custom range (BU PR#5095): 30 of 20–40 is 50%", () => {
    const r = resolveRangeValue({ value: 30, min: 20, max: 40 }, "progress")
    expect(r.percent).toBe(50)
    expect(text(r)).toBe("50%")
    expect(rangeValueAttributes(r, text(r))["aria-valuenow"]).toBe(30)
  })

  it("zero is a value (RK#910, BU#1203)", () => {
    const r = resolveRangeValue({ value: 0 }, "progress")
    expect(r).toMatchObject({ value: 0, percent: 0 })
    expect(text(r)).toBe("0%")
  })

  it.each([null, undefined])("%s is indeterminate (RK#1871)", (value) => {
    const r = resolveRangeValue({ value }, "progress")
    expect(r.value).toBeNull()
    const attrs = rangeValueAttributes(r, text(r))
    expect(attrs["aria-valuenow"]).toBeUndefined()
    expect(attrs["aria-valuetext"]).toBeUndefined()
    expect(attrs).not.toHaveProperty("aria-label")
  })

  it("empty range (RS#10042): no NaN, a warning naming the range", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const r = resolveRangeValue({ value: 0, min: 0, max: 0 }, "progress")
    expect(r.percent).toBe(0)
    // JSON would print NaN as null: check every number directly.
    expect(Object.values(r).every(Number.isFinite)).toBe(true)
    expect(text(r)).toBe("0%")
    expect(warn.mock.calls[0]?.[0]).toMatch(/progress.*min=0 max=0/)
  })

  it("inverted range: fraction 0, warned", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const r = resolveRangeValue({ value: 5, min: 10, max: 0 }, "meter")
    expect(r.fraction).toBe(0)
    expect(Number.isNaN(r.percent)).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it("out of range: clamped, warned, never indeterminate", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const r = resolveRangeValue({ value: 120, max: 100 }, "progress")
    expect(r.value).toBe(100)
    expect(warn.mock.calls[0]?.[0]).toMatch(/value 120/)
  })

  it("units format the value, not the fraction", () => {
    const r = resolveRangeValue({ value: 75 }, "meter")
    expect(text(r, { style: "unit", unit: "gigabyte" })).toBe("75 GB")
  })

  it("value in user units (BU#2263): aria-valuenow 50 of 200", () => {
    const r = resolveRangeValue({ value: 50, max: 200 }, "progress")
    expect(rangeValueAttributes(r, text(r))).toMatchObject({
      "aria-valuenow": 50,
      "aria-valuemax": 200,
      "aria-valuetext": "25%",
    })
  })
})
