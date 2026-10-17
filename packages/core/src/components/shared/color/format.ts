// formatColor (color-model "Formatting"): pure, locale-independent, never exponent notation.

import { roundTo } from "../step-math"
import type { Color, ColorFormat } from "./color"
import { toSpace } from "./convert"

/** A number as plain decimal text (no exponent, no locale). */
const num = (n: number, places: number) => {
  const r = roundTo(n, places)
  const s = (Object.is(r, -0) ? 0 : r).toFixed(places)
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s
}

const hex2 = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()

/** The alpha as a byte (`round(alpha * 255)`), the unit sRGB comparison and hex use. */
export const alphaByte = (alpha: number) => Math.round(Math.min(1, Math.max(0, alpha)) * 255)

export function formatColor(color: Color, format: ColorFormat): string {
  const a = color.alpha
  const alpha = a < 1 ? `, ${num(a, 2)}` : ""
  switch (format) {
    case "hex": {
      const [r, g, b] = toSpace(color, "rgb").channels
      return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(alphaByte(a)) : ""}`
    }
    case "rgb": {
      const [r, g, b] = toSpace(color, "rgb").channels
      return `${a < 1 ? "rgba" : "rgb"}(${num(r, 0)}, ${num(g, 0)}, ${num(b, 0)}${alpha})`
    }
    case "hsl": {
      const [h, s, l] = toSpace(color, "hsl").channels
      return `${a < 1 ? "hsla" : "hsl"}(${num(h, 2)}, ${num(s, 2)}%, ${num(l, 2)}%${alpha})`
    }
    case "hsb": {
      const [h, s, b] = toSpace(color, "hsb").channels
      return `${a < 1 ? "hsba" : "hsb"}(${num(h, 2)}, ${num(s, 2)}%, ${num(b, 2)}%${alpha})`
    }
    case "css":
      if (color.space === "hsl") return formatColor(color, "hsl")
      return formatColor(color, a < 1 ? "rgb" : "hex")
  }
}

/** The canonical form forms submit: `#RRGGBB`, `#RRGGBBAA` when alpha is below 1. */
export const canonicalHex = (color: Color) => formatColor(color, "hex")
