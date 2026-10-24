import { describe, expect, it } from "vitest"
import { PRESETS, textOn } from "./skins"

/** WCAG contrast of two #rrggbb colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r = 0, g = 0, b2 = 0] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// every ready skin must read: its text on its ground, and a button's label on the button
describe.each(PRESETS.filter((p) => p.look.brand !== null))("$name", ({ look }) => {
  const brand = look.brand ?? ""
  it("text on its surface reaches 4.5:1", () => {
    expect(contrast(textOn(look.surface), look.surface)).toBeGreaterThanOrEqual(4.5)
  })
  it("a button's label reaches 4.5:1", () => {
    // an outline button's label is the brand on the surface; any other, ink or white on the brand
    const [fg, bg] = look.fill === "outline" ? [brand, look.surface] : [textOn(brand), brand]
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
})
