// Meter's parts as pure functions of props (add-meter 2.1).
import { afterEach, describe, expect, it, vi } from "vitest"
import { rangeValueText, resolveRangeValue } from "../shared/range-value"
import { checkMeterValue, meterConnect } from "./meter.connect"
import { type MeterValueTextArgs, meterMessages } from "./meter.messages"
import { type MeterThresholds, meterZone } from "./meter.zone"

afterEach(() => vi.restoreAllMocks())

function make(
  input: { value: number; min?: number; max?: number } & MeterThresholds,
  options: {
    formatOptions?: Intl.NumberFormatOptions
    valueText?: (a: MeterValueTextArgs) => string
  } = {},
) {
  const range = resolveRangeValue(input)
  const zone = meterZone(range, input)
  const text = rangeValueText(
    range,
    { locale: "en-US", formatOptions: options.formatOptions },
    options.valueText ?? meterMessages.valueText,
    { zone },
  )
  return meterConnect({ instance: "m", range, zone, text, orientation: "horizontal" })
}

describe("meter connect", () => {
  it("Root: exactly role=meter, value attributes, data (RS#6627, RS#10737)", () => {
    expect(make({ value: 3, max: 5 }).root()).toMatchObject({
      role: "meter",
      "aria-valuenow": 3,
      "aria-valuemin": 0,
      "aria-valuemax": 5,
      "aria-valuetext": "60%",
      "data-value": "3",
      "data-min": "0",
      "data-max": "5",
    })
  })

  it("zones on every part; none without thresholds", () => {
    const battery = { low: 20, high: 80, optimum: 100 }
    const c = make({ value: 10, ...battery })
    for (const p of [c.root(), c.label("l"), c.valueText(), c.track(), c.indicator()]) {
      expect(p["data-zone"]).toBe("even-less-good")
    }
    expect(make({ value: 50, ...battery }).root()["data-zone"]).toBe("suboptimum")
    expect(make({ value: 50 }).root()["data-zone"]).toBeUndefined()
  })

  it("zone spoken through the value text (BU#1434)", () => {
    const c = make(
      { value: 10, low: 20, high: 80, optimum: 100 },
      {
        valueText: ({ formatted, zone }) =>
          zone === "even-less-good" ? `${formatted}, low` : formatted,
      },
    )
    expect(c.root()["aria-valuetext"]).toBe("10%, low")
  })

  it("unclamped text (BU PR#5409): 130 of 100 reads 100", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const c = make({ value: 130 }, { formatOptions: { style: "unit", unit: "percent" } })
    expect(c.root()["aria-valuetext"]).toBe("100%")
    expect(c.root()["aria-valuenow"]).toBe(100)
  })

  it("fill: --rind-meter-percent and inline size, 0% included; ValueText hidden", () => {
    expect(make({ value: 0 }).indicator()["style"]).toEqual({
      "--rind-meter-percent": "0",
      "inline-size": "0%",
    })
    expect(make({ value: 1 }).valueText()["aria-hidden"]).toBe("true")
  })

  it("never a live region", () => {
    const c = make({ value: 1 })
    for (const p of [c.root(), c.valueText(), c.track(), c.indicator()]) {
      expect(p).not.toHaveProperty("aria-live")
    }
  })

  it("missing value: a development error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    checkMeterValue(5)
    expect(error).not.toHaveBeenCalled()
    checkMeterValue(undefined)
    expect(error.mock.calls[0]?.[0]).toMatch(/meter: value is required/)
  })
})
