import { describe, expect, it } from "vitest"
import { angleSliderMachine } from "../angle-slider/angle-slider.machine"
import { formatColor } from "../shared/color/format"
import { parseColor } from "../shared/color/parse"
import { colorWheelConnect, colorWheelMessages, colorWithHue, hueOf } from "./color-wheel.connect"
import { colorWheelContract } from "./color-wheel.contract"
import { colorWheelMeta } from "./color-wheel.meta"

describe("color wheel binding", () => {
  it("only the hue changes", () => {
    const next = colorWithHue(parseColor("hsl(0 80% 40%)"), 120, undefined)
    expect(formatColor(next, "hsl")).toBe("hsl(120, 80%, 40%)")
  })

  it("hsb when asked for", () => {
    expect(colorWithHue(parseColor("#ff0000"), 240, "hsb").space).toBe("hsb")
  })

  it("the hue is on the step grid and wraps", () => {
    expect(hueOf(parseColor("hsl(359.7 50% 50%)"), 1)).toBe(0)
    expect(hueOf(parseColor("hsl(37 50% 50%)"), 15)).toBe(30)
  })
})

const red = parseColor("#ff0000")
const api = (over: Partial<Parameters<typeof colorWheelConnect>[0]> = {}) =>
  colorWheelConnect({
    instance: "w",
    color: parseColor("hsl(240 100% 50%)"),
    step: 1,
    dragging: true,
    disabled: true,
    readOnly: true,
    invalid: true,
    focused: true,
    modality: "keyboard",
    locale: "en-US",
    messages: colorWheelMessages,
    ids: { label: "l", input: "i" },
    rendered: { label: false },
    defaultColor: red,
    name: "accent",
    ...over,
  })
const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("color wheel connect", () => {
  it("one slider named Hue, the hue in words", () => {
    expect(api().input()).toMatchObject({
      type: "range",
      max: 359,
      value: "240",
      "aria-label": "Hue",
      "aria-valuetext": "Hue 240°, blue",
    })
    expect(api().root()).toMatchObject({ role: "group" })
  })

  it("a conic gradient on the track; the colour submitted as hex", () => {
    const style = api().track()["style"] as Record<string, string>
    expect(style["--rind-color-wheel-gradient"]).toMatch(/^conic-gradient\(/)
    expect(api({ color: red }).hiddenInput()).toMatchObject({ name: "accent", value: "#FF0000" })
  })

  it("meta matches the code", () => {
    const a = api()
    const parts = {
      root: a.root(),
      label: a.label(),
      track: a.track(),
      thumb: a.thumb(),
      input: a.input(),
      value: a.valuePart(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = colorWheelMeta.dataAttributes[part as keyof typeof colorWheelMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
    expect(colorWheelMeta.contract.queries).toEqual(Object.keys(colorWheelContract.queries))
    expect(Object.keys(colorWheelMeta.states)).toEqual(Object.keys(angleSliderMachine.def.states))
  })
})
