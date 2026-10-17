import { describe, expect, it } from "vitest"
import { parseColor } from "../shared/color/parse"
import { colorSwatchConnect, colorSwatchMessages } from "./color-swatch.connect"
import { colorSwatchContract } from "./color-swatch.contract"
import { colorSwatchMeta } from "./color-swatch.meta"

describe("color swatch meta matches the code", () => {
  it("contract", () => {
    expect(colorSwatchMeta.contract.queries).toEqual(Object.keys(colorSwatchContract.queries))
  })
  it("data attributes", () => {
    const keys = Object.keys(
      colorSwatchConnect({
        instance: "i",
        color: parseColor("#FF000080"),
        messages: colorSwatchMessages,
      }).root(),
    ).filter((k) => k.startsWith("data-"))
    expect(Object.keys(colorSwatchMeta.dataAttributes.root).sort()).toEqual(keys.sort())
  })
})
