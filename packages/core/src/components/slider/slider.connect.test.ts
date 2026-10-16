// Slider connect in Node: positions as pure strings (server = client), naming, bounds and
// the key mapping through the one axis function.
import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { mergeFieldProps } from "../shared/field-control"
import { type SliderConnectInput, sliderConnect, sliderKeyEvent } from "./slider.connect"
import { sliderRange } from "./slider.math"
import { sliderMessages } from "./slider.messages"

const key = (k: string, shift = false) => ({
  key: k,
  code: "",
  shift,
  alt: false,
  ctrl: false,
  meta: false,
  repeat: false,
  composing: false,
})

function input(over: Partial<SliderConnectInput> = {}): SliderConnectInput {
  return {
    instance: "s",
    values: [40],
    range: sliderRange({}),
    orientation: "horizontal",
    dir: "ltr",
    alignment: "center",
    field: mergeFieldProps({ role: "slider", labelable: false }, null),
    thumbDisabled: [],
    focused: null,
    modality: "keyboard",
    active: null,
    draggingThumb: null,
    dragging: false,
    ids: { root: "s", label: "s-label", description: "s-desc", input: (i) => `s-input-${i}` },
    labelledBy: "s-label",
    locale: "en",
    messages: sliderMessages,
    defaultValues: [40],
    ...over,
  }
}

describe("slider connect", () => {
  it("positions a centred thumb with logical properties, mirrored translate in RTL", () => {
    const ltr = sliderConnect(input()).thumb(0)["style"] as Record<string, string>
    expect(ltr["inset-inline-start"]).toBe("40%")
    expect(ltr["translate"]).toBe("-50% 0")
    const rtl = sliderConnect(input({ dir: "rtl" })).thumb(0)["style"] as Record<string, string>
    expect(rtl["inset-inline-start"]).toBe("40%")
    expect(rtl["translate"]).toBe("50% 0")
  })

  it("contain is computed in CSS from --rind-slider-thumb-size (no measurement)", () => {
    const style = sliderConnect(input({ alignment: "contain" })).thumb(0)["style"] as Record<
      string,
      string
    >
    expect(style["inset-inline-start"]).toBe(
      "calc(var(--rind-slider-thumb-size, 0px) / 2 + (100% - var(--rind-slider-thumb-size, 0px)) * 0.4)",
    )
  })

  it("vertical grows upward from the bottom", () => {
    const api = sliderConnect(input({ orientation: "vertical" }))
    const style = api.thumb(0)["style"] as Record<string, string>
    expect(style["bottom"]).toBe("40%")
    expect(api.input(0)["aria-orientation"]).toBe("vertical")
    expect((api.input(0)["style"] as Record<string, string>)["writing-mode"]).toBe("vertical-lr")
  })

  it("thumb inputs carry value attributes, neighbour bounds and the current default", () => {
    const api = sliderConnect(
      input({
        values: [20, 60],
        defaultValues: [10, 90],
        range: sliderRange({ minStepsBetweenThumbs: 5 }),
      }),
    )
    expect(api.input(0)).toMatchObject({
      type: "range",
      min: 0,
      max: 55,
      "aria-valuenow": 20,
      "aria-valuemin": 0,
      "aria-valuemax": 55,
      "aria-valuetext": "20",
      defaultValue: "10",
      "aria-labelledby": "s-label s-input-0",
      "aria-label": "Minimum",
    })
    expect(api.input(1)).toMatchObject({ min: 25, max: 100, "aria-label": "Maximum" })
  })

  it("a single thumb is named by the Label only (no self reference reading the value)", () => {
    const api = sliderConnect(input())
    expect(api.input(0)["aria-labelledby"]).toBe("s-label")
    expect(api.input(0)["aria-label"]).toBeUndefined()
  })

  it("never renders a tabindex or a value attribute from the value", () => {
    const p = sliderConnect(input({ values: [70], defaultValues: [40] })).input(0)
    expect(p["tabIndex"]).toBeUndefined()
    expect(p["value"]).toBeUndefined()
    expect(p["defaultValue"]).toBe("40")
  })

  it("the Indicator spans start to end, with custom properties", () => {
    const style = sliderConnect(input({ values: [20, 70] })).indicator()["style"] as Record<
      string,
      string
    >
    expect(style).toMatchObject({
      "--rind-slider-start": "20%",
      "--rind-slider-end": "70%",
      "inset-inline-start": "20%",
      "inline-size": "50%",
    })
  })

  it("ValueText: a value, a range, a list", () => {
    expect(sliderConnect(input()).valueText().text).toBe("40")
    expect(sliderConnect(input({ values: [20, 80] })).valueText().text).toBe(
      new Intl.NumberFormat("en").formatRange(20, 80),
    )
    expect(sliderConnect(input({ values: [20, 20] })).valueText().text).toBe("20")
    expect(sliderConnect(input({ values: [1, 2, 3] })).valueText().text).toMatch(/1.*2.*3/)
  })

  it("maps keys through the one axis (RTL horizontal mirrors, Up always increases)", () => {
    const a = {
      orientation: "horizontal" as const,
      dir: "rtl" as const,
      platform: platforms.linux,
      dragging: false,
    }
    expect(sliderKeyEvent(key("ArrowLeft"), 0, a)?.type).toBe("INCREASE")
    expect(sliderKeyEvent(key("ArrowUp"), 0, a)?.type).toBe("INCREASE")
    expect(sliderKeyEvent(key("PageUp"), 0, a)?.type).toBe("PAGE_PREV")
    expect(sliderKeyEvent(key("ArrowRight", true), 1, a)).toMatchObject({
      type: "DECREASE",
      shift: true,
      thumb: 1,
    })
    expect(sliderKeyEvent(key("Escape"), 0, a)).toBeNull()
    expect(sliderKeyEvent(key("Escape"), 0, { ...a, dragging: true })).toEqual({
      type: "DRAG.CANCEL",
    })
    expect(sliderKeyEvent(key("Enter"), 0, a)).toBeNull()
  })

  it("disabled thumbs: native disabled, data-disabled, same position (RK#1691)", () => {
    const api = sliderConnect(input({ thumbDisabled: [true] }))
    expect(api.input(0)["disabled"]).toBe(true)
    expect(api.thumb(0)["data-disabled"]).toBe("")
  })
})
