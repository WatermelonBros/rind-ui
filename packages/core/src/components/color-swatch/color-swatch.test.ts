// Color Swatch connect (task 3.1): role, name, transparency, alpha, forced colours.
import { describe, expect, it, vi } from "vitest"
import { parseColor } from "../shared/color/parse"
import {
  colorSwatchConnect,
  colorSwatchMessages,
  swatchColor,
  swatchName,
} from "./color-swatch.connect"

const root = (color: string, more: object = {}) =>
  colorSwatchConnect({
    instance: "s",
    color: parseColor(color),
    messages: colorSwatchMessages,
    ...more,
  }).root()

describe("Color Swatch", () => {
  it("names by the colour", () => {
    const r = root("#FF0000")
    expect(r["role"]).toBe("img")
    expect(r["aria-label"]).toBe("vibrant red")
    expect(r["aria-roledescription"]).toBe("color swatch")
  })

  it("consumer name and label", () => {
    expect(
      swatchName({
        instance: "s",
        color: parseColor("#FF0000"),
        messages: colorSwatchMessages,
        colorName: "Brand red",
        ariaLabel: "Primary",
      }),
    ).toBe("Brand red, Primary")
  })

  it("transparent", () => {
    expect(root("#00000000")["aria-label"]).toBe("transparent")
  })

  it("alpha and respectAlpha", () => {
    const alpha = root("#FF000080")
    expect(alpha["data-transparent"]).toBe("")
    expect((alpha["style"] as Record<string, string>)["background-color"]).toBe(
      "rgba(255, 0, 0, 0.5)",
    )
    const opaque = root("#FF000080", { respectAlpha: false })
    expect(opaque["data-transparent"]).toBeUndefined()
    expect((opaque["style"] as Record<string, string>)["background-color"]).toBe("#FF0000")
  })

  it("forced colours keep the colour", () => {
    expect((root("#336699")["style"] as Record<string, string>)["forced-color-adjust"]).toBe("none")
  })

  it("decorative swatch has no role", () => {
    const r = root("#336699", { decorative: true })
    expect(r["role"]).toBeUndefined()
    expect(r["aria-hidden"]).toBe("true")
  })

  it("an unparsable colour is a development error and transparent", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(swatchColor("var(--x)").alpha).toBe(0)
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})
