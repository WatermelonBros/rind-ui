// Color Swatch Picker matching (task 6.1) and its meta.
import { describe, expect, it } from "vitest"
import { parseColor } from "../shared/color/parse"
import { matchSwatch, pickedColor, swatchKey } from "./color-swatch-picker.connect"
import { colorSwatchPickerContract } from "./color-swatch-picker.contract"
import { colorSwatchPickerMeta } from "./color-swatch-picker.meta"

const items = [
  { key: "primary", color: parseColor("#FF0000") },
  { key: "danger", color: parseColor("#FF0000") },
  { key: "black", color: parseColor("#000000") },
]

describe("matchSwatch", () => {
  it("no match checks nothing (react-spectrum#7918)", () => {
    expect(matchSwatch(items, parseColor("#123456"), null)).toBeNull()
    expect(matchSwatch(items, null, null)).toBeNull()
  })
  it("first match, unless the last chosen still matches (react-spectrum#10251)", () => {
    expect(matchSwatch(items, parseColor("#FF0000"), null)).toBe("primary")
    expect(matchSwatch(items, parseColor("#FF0000"), "danger")).toBe("danger")
    expect(matchSwatch(items, parseColor("#000000"), "danger")).toBe("black")
  })
  it("matches across spaces", () => {
    expect(matchSwatch(items, parseColor("hsb(0, 100%, 100%)"), null)).toBe("primary")
  })
  it("keys and alpha", () => {
    expect(swatchKey(parseColor("#00FF00"))).toBe("#00FF00FF")
    expect(pickedColor(parseColor("#00FF00"), parseColor("#FF000080")).alpha).toBe(0.5)
    expect(pickedColor(parseColor("#00FF0080"), parseColor("#FF0000")).alpha).toBe(0.5)
  })
  it("meta queries exist", () => {
    for (const q of colorSwatchPickerMeta.contract.queries) {
      expect(Object.keys(colorSwatchPickerContract.queries)).toContain(q)
    }
  })
})
