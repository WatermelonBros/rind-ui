// Conversion between rgb, hsl and hsb (color-model "Conversion And Hue Memory"). Results are
// rounded to each channel's precision; an achromatic colour converted into a hue space takes
// the remembered hue (react-spectrum#9509), and a hue the source carries is never lost.

import { roundTo } from "../step-math"
import { type Color, type ColorMemory, type ColorSpace, makeColor } from "./color"

type Triple = readonly [number, number, number]

const r2 = (n: number) => roundTo(n, 2)
const wrapHue = (h: number) => (h === 360 ? 360 : ((h % 360) + 360) % 360)

/** rgb (0–255) → hsb (h 0–360, s and b 0–100), unrounded; hue null when achromatic. */
function rgbToHsb([r, g, b]: Triple): { h: number | null; s: number; v: number } {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const d = max - min
  let h: number | null = null
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

/** hsb → rgb (unrounded, 0–255). */
function hsbToRgb([h, s, v]: Triple): Triple {
  const S = s / 100
  const V = v / 100
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return V - V * S * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}

/** hsb → hsl saturation and lightness (hue unchanged); s null where undefined (l 0 or 100). */
function hsbToHsl(s: number, v: number): { s: number | null; l: number } {
  const S = s / 100
  const V = v / 100
  const l = V * (1 - S / 2)
  const sl = l === 0 || l === 1 ? null : (V - l) / Math.min(l, 1 - l)
  return { s: sl === null ? null : sl * 100, l: l * 100 }
}

/** hsl → hsb saturation and brightness; s null where undefined (b 0). */
function hslToHsb(s: number, l: number): { s: number | null; v: number } {
  const S = s / 100
  const L = l / 100
  const v = L + S * Math.min(L, 1 - L)
  return { s: v === 0 ? null : 2 * (1 - L / v) * 100, v: v * 100 }
}

const isAchromatic = (c: Color) =>
  c.space === "rgb" ? c.channels[0] === c.channels[1] && c.channels[1] === c.channels[2] : false

/** The colour in `space`; the same object when it already is. */
export function toSpace(color: Color, space: ColorSpace, memory?: ColorMemory): Color {
  if (color.space === space) return color
  const a = color.alpha
  const [x, y, z] = color.channels
  if (space === "rgb") {
    const hsb: Triple =
      color.space === "hsb" ? color.channels : [x, hslToHsb(y, z).s ?? 0, hslToHsb(y, z).v]
    const [r, g, b] = hsbToRgb(hsb)
    return makeColor("rgb", [Math.round(r), Math.round(g), Math.round(b)], a)
  }
  if (color.space === "rgb") {
    const { h, s, v } = rgbToHsb(color.channels)
    // Achromatic (no hue): the remembered hue, else 0 (react-spectrum#9509).
    const hue = h === null || isAchromatic(color) ? (memory?.hue ?? 0) : h
    const blackOrWhite = v === 0 || (s === 0 && v === 100)
    const sat = blackOrWhite && memory?.saturation !== undefined ? memory.saturation : s
    if (space === "hsb") return makeColor("hsb", [r2(wrapHue(hue)), r2(sat), r2(v)], a)
    const hsl = hsbToHsl(sat, v)
    return makeColor("hsl", [r2(wrapHue(hue)), r2(hsl.s ?? memory?.saturation ?? 0), r2(hsl.l)], a)
  }
  // hsl ⇄ hsb: the hue the source carries is kept as it is.
  if (color.space === "hsb" && space === "hsl") {
    const hsl = hsbToHsl(y, z)
    return makeColor("hsl", [x, r2(hsl.s ?? memory?.saturation ?? y), r2(hsl.l)], a)
  }
  const hsb = hslToHsb(y, z)
  return makeColor("hsb", [x, r2(hsb.s ?? memory?.saturation ?? y), r2(hsb.v)], a)
}

/**
 * The hue and saturation to remember after seeing `color`: its own when it has chroma, else
 * the previous memory.
 */
export function colorMemory(color: Color, previous?: ColorMemory): ColorMemory {
  if (color.space === "rgb") {
    const { h, s, v } = rgbToHsb(color.channels)
    return h !== null && s > 0 && v > 0 ? { hue: r2(h), saturation: r2(s) } : (previous ?? {})
  }
  const [h, s, third] = color.channels
  return s > 0 && third > 0 ? { hue: h, saturation: s } : { ...previous, hue: h }
}
