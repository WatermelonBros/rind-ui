// Progress's parts as pure functions of props (add-progress 3.1), and the repro of the quirk
// `nvda-progressbar-name` (BU#4184): Root's filler is one visually hidden, presentational
// character, so NVDA has text content to hang the name on.
import { afterEach, describe, expect, it, vi } from "vitest"
import { quirkActive, quirks } from "../../dom/quirks"
import {
  checkRangeName,
  rangeFillerProps,
  rangeValueText,
  resolveRangeValue,
} from "../shared/range-value"
import { progressConnect } from "./progress.connect"
import { progressMessages } from "./progress.messages"

afterEach(() => vi.restoreAllMocks())

const make = (input: Parameters<typeof resolveRangeValue>[0], orientation = "horizontal") => {
  const range = resolveRangeValue(input)
  const text = rangeValueText(range, { locale: "en-US" }, progressMessages.valueText)
  return progressConnect({
    instance: "p",
    range,
    text,
    orientation: orientation as "horizontal" | "vertical",
    labelledBy: "label-id",
  })
}

describe("progress connect", () => {
  it("Root: progressbar, value attributes, labelled by the Label", () => {
    expect(make({ value: 40 }).root()).toMatchObject({
      role: "progressbar",
      "aria-valuenow": 40,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuetext": "40%",
      "aria-labelledby": "label-id",
      "data-state": "loading",
      "data-value": "40",
      "data-min": "0",
      "data-max": "100",
    })
  })

  it("custom range: valuetext 25% of 0–8, valuenow 2", () => {
    expect(make({ value: 2, max: 8 }).root()).toMatchObject({
      "aria-valuenow": 2,
      "aria-valuetext": "25%",
    })
  })

  it("indeterminate: no value attributes, no fill, no offset", () => {
    const c = make({ value: null })
    expect(c.root()["aria-valuenow"]).toBeUndefined()
    expect(c.root()["aria-valuetext"]).toBeUndefined()
    expect(c.root()["data-value"]).toBeUndefined()
    expect(c.root()["data-state"]).toBe("indeterminate")
    expect(c.indicator()["style"]).toBeUndefined()
    expect(c.circleIndicator()["stroke-dashoffset"]).toBeUndefined()
  })

  it("complete: every part data-state=complete", () => {
    const c = make({ value: 100 })
    for (const p of [c.root(), c.label("l"), c.valueText(), c.track(), c.indicator()]) {
      expect(p["data-state"]).toBe("complete")
    }
  })

  it("fill: 0% at 0, block-size when vertical, never aria-orientation", () => {
    expect(make({ value: 0 }).indicator()["style"]).toEqual({
      "--rind-progress-percent": "0",
      "inline-size": "0%",
    })
    const v = make({ value: 30 }, "vertical")
    expect(v.indicator()["style"]).toEqual({ "--rind-progress-percent": "30", "block-size": "30%" })
    expect(v.root()["aria-orientation"]).toBeUndefined()
    expect(v.track()["data-orientation"]).toBe("vertical")
  })

  it("ring at a quarter: dashoffset 75, pathLength 100", () => {
    const c = make({ value: 25 })
    expect(c.circleIndicator()).toMatchObject({
      pathLength: "100",
      "stroke-dasharray": "100",
      "stroke-dashoffset": "75",
    })
    expect(c.circleTrack()["pathLength"]).toBe("100")
    expect(c.circle()["aria-hidden"]).toBe("true")
  })

  it("ValueText is hidden; no part is a live region", () => {
    const c = make({ value: 10 })
    expect(c.valueText()["aria-hidden"]).toBe("true")
    for (const p of [c.root(), c.valueText(), c.track(), c.indicator(), c.label("l")]) {
      expect(p).not.toHaveProperty("aria-live")
    }
    expect(c.root()).not.toHaveProperty("aria-label")
  })

  it("nvda-progressbar-name: a visually hidden, presentational one-character filler", () => {
    expect(rangeFillerProps.role).toBe("presentation")
    expect(rangeFillerProps.children).toHaveLength(1)
    expect(rangeFillerProps.style).toMatchObject({ position: "fixed", overflow: "hidden" })
    const entry = quirks.find((q) => q.id === "nvda-progressbar-name")
    expect(entry?.removeWhen).toMatch(/nvda#16204/)
    expect(quirkActive("nvda-progressbar-name", { platform: {} as never } as never)).toBe(true)
  })

  it("name check: error unless named, labelled or aria-hidden (RS#9987)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    checkRangeName("progress", {}, true)
    checkRangeName("progress", { "aria-label": "Upload" }, false)
    checkRangeName("progress", { "aria-hidden": "true" }, false)
    expect(error).not.toHaveBeenCalled()
    checkRangeName("progress", {}, false)
    expect(error.mock.calls[0]?.[0]).toMatch(/progress: Root has no accessible name/)
  })
})
