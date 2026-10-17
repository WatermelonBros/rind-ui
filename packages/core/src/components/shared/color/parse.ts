// parseColor (color-model "Parsing"): hex, rgb()/hsl() in the legacy comma and the CSS Color 4
// space-and-slash forms, hsb(), and `transparent`. Out-of-range channels clamp; hue wraps,
// except exactly 360 (react-spectrum#6202). `#` is required here; fields parse leniently.

import { roundTo } from "../step-math"
import {
  type Color,
  type ColorInput,
  ColorParseError,
  type ColorSpace,
  isColor,
  makeColor,
} from "./color"

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FN = /^(rgba?|hsla?|hsba?)\((.*)\)$/i
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

/** A token: a plain number, a percentage, or a hue in degrees. */
function token(s: string): { readonly n: number; readonly unit: "" | "%" | "deg" } | null {
  const t = s.trim().toLowerCase()
  const unit = t.endsWith("%") ? "%" : t.endsWith("deg") ? "deg" : ""
  const body = unit === "%" ? t.slice(0, -1) : unit === "deg" ? t.slice(0, -3) : t
  if (!NUMBER.test(body)) return null
  const n = Number(body)
  return Number.isFinite(n) ? { n, unit } : null
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const wrapHue = (h: number) => (h === 360 ? 360 : ((h % 360) + 360) % 360)

function parseHex(hex: string): Color {
  let h = hex.slice(1)
  if (h.length <= 4) h = [...h].map((c) => c + c).join("")
  const byte = (i: number) => Number.parseInt(h.slice(i, i + 2), 16)
  // Unrounded: every alpha byte survives a hex round trip (`alphaByte` rounds back).
  const alpha = h.length === 8 ? byte(6) / 255 : 1
  return makeColor("rgb", [byte(0), byte(2), byte(4)], alpha)
}

/** The arguments of a colour function: three channels and an optional alpha, or null. */
function args(body: string): string[] | null {
  const inner = body.trim()
  if (inner.includes(",")) {
    const parts = inner.split(",").map((p) => p.trim())
    return parts.length === 3 || parts.length === 4 ? parts : null
  }
  const [main = "", alpha, extra] = inner.split("/")
  if (extra !== undefined) return null
  const parts = main.trim().split(/\s+/).filter(Boolean)
  if (parts.length !== 3) return null
  if (alpha === undefined) return parts
  return alpha.trim() === "" ? null : [...parts, alpha.trim()]
}

function alphaOf(s: string | undefined): number | null {
  if (s === undefined) return 1
  const t = token(s)
  if (!t || t.unit === "deg") return null
  return roundTo(clamp(t.unit === "%" ? t.n / 100 : t.n, 0, 1), 2)
}

function parseFunction(name: string, body: string): Color | null {
  const list = args(body)
  if (!list) return null
  const [a, b, c, alphaText] = list
  const alpha = alphaOf(alphaText)
  const t = [a, b, c].map((s) => token(s ?? ""))
  if (alpha === null || t.some((x) => x === null)) return null
  const [x, y, z] = t as { n: number; unit: "" | "%" | "deg" }[]
  if (!x || !y || !z) return null
  const space: ColorSpace = name.startsWith("rgb") ? "rgb" : name.startsWith("hsl") ? "hsl" : "hsb"
  if (space === "rgb") {
    if ([x, y, z].some((v) => v.unit === "deg")) return null
    const ch = (v: { n: number; unit: string }) =>
      Math.round(clamp(v.unit === "%" ? v.n * 2.55 : v.n, 0, 255))
    return makeColor("rgb", [ch(x), ch(y), ch(z)], alpha)
  }
  if (x.unit === "%" || y.unit === "deg" || z.unit === "deg") return null
  const pct = (v: { n: number }) => roundTo(clamp(v.n, 0, 100), 2)
  return makeColor(space, [roundTo(wrapHue(x.n), 2), pct(y), pct(z)], alpha)
}

/** Parses a colour string; throws `ColorParseError` for anything else. */
export function parseColor(input: string): Color {
  const color = tryParseColor(input)
  if (!color) throw new ColorParseError(input)
  return color
}

/** `parseColor` returning `null` instead of throwing. */
export function tryParseColor(input: string): Color | null {
  if (typeof input !== "string") return null
  const s = input.trim()
  if (s.toLowerCase() === "transparent") return makeColor("rgb", [0, 0, 0], 0)
  if (HEX.test(s)) return parseHex(s)
  const m = FN.exec(s)
  if (!m) return null
  return parseFunction((m[1] ?? "").toLowerCase(), m[2] ?? "")
}

/** A colour from `string | Color`; throws `ColorParseError` for anything else. */
export function toColor(input: ColorInput): Color {
  if (typeof input === "string") return parseColor(input)
  if (isColor(input)) return input
  throw new ColorParseError(input)
}

/** `toColor` returning `null` instead of throwing. */
export function tryToColor(input: unknown): Color | null {
  if (typeof input === "string") return tryParseColor(input)
  return isColor(input) ? input : null
}
