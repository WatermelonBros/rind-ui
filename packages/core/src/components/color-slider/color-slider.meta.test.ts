import { describe, expect, it } from "vitest"
import { makeColor } from "../shared/color/color"
import { colorSliderConnect, colorSliderMessages } from "./color-slider.connect"
import { colorSliderContract } from "./color-slider.contract"
import { colorSliderMeta } from "./color-slider.meta"

describe("color slider meta matches the code", () => {
  it("contract queries it adds exist", () => {
    for (const q of colorSliderMeta.contract.queries) {
      expect(Object.keys(colorSliderContract.queries)).toContain(q)
    }
    expect(colorSliderMeta.contract.traits).toEqual(colorSliderContract.traits)
  })
  it("data attributes", () => {
    const api = colorSliderConnect({
      color: makeColor("hsb", [10, 20, 30]),
      channel: "hue",
      orientation: "horizontal",
      dir: "ltr",
      messages: colorSliderMessages,
      locale: "en-US",
    })
    expect(Object.keys(colorSliderMeta.dataAttributes.root).sort()).toEqual(
      Object.keys(api.data).sort(),
    )
  })
})
