// Colour maths for the theme builder: parsing, OKLCH <-> sRGB, gamut mapping, WCAG 2.
// Pure functions, no DOM and no globals, so it runs in Node, workers and the browser.

/** OKLCH, l 0–1, c ≥ 0, h degrees 0–360 (NaN/none → 0 for achromatic), alpha 0–1. */
export interface Oklch {
  readonly l: number
  readonly c: number
  readonly h: number
  readonly alpha: number
}

/** Gamma-encoded sRGB 0–1; may be out of 0–1 before gamut mapping. */
export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly alpha: number
}

const DEG = Math.PI / 180
// Below this chroma the hue is numerical noise (white comes out at ~1e-8).
const ACHROMATIC = 1e-6
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// sRGB transfer functions, sign-preserving so out-of-gamut values survive the round trip.
const toLinear = (u: number) => {
  const a = Math.abs(u)
  return Math.sign(u) * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4)
}
const toGamma = (u: number) => {
  const a = Math.abs(u)
  return Math.sign(u) * (a <= 0.0031308 ? a * 12.92 : 1.055 * a ** (1 / 2.4) - 0.055)
}

type Lab = readonly [number, number, number]

// Björn Ottosson's OKLab matrices (linear sRGB <-> LMS <-> Lab).
function linearToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToLinear(L: number, a: number, b: number): Lab {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function labToOklch([l, a, b]: Lab, alpha: number): Oklch {
  const c = Math.hypot(a, b)
  if (c < ACHROMATIC) return { l, c: 0, h: 0, alpha }
  return { l, c, h: (((Math.atan2(b, a) / DEG) % 360) + 360) % 360, alpha }
}

export function oklchToRgb(c: Oklch): Rgb {
  const [r, g, b] = oklabToLinear(c.l, c.c * Math.cos(c.h * DEG), c.c * Math.sin(c.h * DEG))
  return { r: toGamma(r), g: toGamma(g), b: toGamma(b), alpha: c.alpha }
}

export function rgbToOklch(c: Rgb): Oklch {
  return labToOklch(linearToOklab(toLinear(c.r), toLinear(c.g), toLinear(c.b)), c.alpha)
}

/** Inside the sRGB cube, within `epsilon` (default absorbs matrix round-trip noise). */
export function inGamut(c: Oklch, epsilon = 1e-5): boolean {
  const { r, g, b } = oklchToRgb(c)
  return [r, g, b].every((u) => u >= -epsilon && u <= 1 + epsilon)
}

const clipRgb = (c: Rgb): Rgb => ({
  r: clamp(c.r, 0, 1),
  g: clamp(c.g, 0, 1),
  b: clamp(c.b, 0, 1),
  alpha: c.alpha,
})

/**
 * CSS Color 4 gamut mapping by chroma reduction at constant L and H (binary search), L clamped
 * to [0,1]; returns an in-gamut colour. Unlike the spec's final step it does not return the
 * clipped colour at ΔEOK < 0.02: clipping moves lightness (by up to ~0.01), and the builder
 * measures contrast on the painted colour, so L and H are kept exact instead.
 */
export function gamutMap(c: Oklch): Oklch {
  const l = clamp(c.l, 0, 1)
  if (l >= 1) return { l: 1, c: 0, h: 0, alpha: c.alpha }
  if (l <= 0) return { l: 0, c: 0, h: 0, alpha: c.alpha }
  const origin: Oklch = { ...c, l }
  if (inGamut(origin)) return origin
  let lo = 0
  let hi = origin.c
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2
    if (inGamut({ ...origin, c: mid }, 0)) lo = mid
    else hi = mid
  }
  return { ...origin, c: lo }
}

/** WCAG 2 relative luminance of an in-gamut colour (alpha ignored). */
export function luminance(c: Oklch): number {
  const { r, g, b } = clipRgb(oklchToRgb(c))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** WCAG 2 contrast ratio (≥ 1). */
export function contrast(a: Oklch, b: Oklch): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Number(toFixed) trims trailing zeros; `|| 0` turns -0 into 0.
const round = (x: number, digits: number) => String(Number(x.toFixed(digits)) || 0)

/** `oklch(L C H)` with L, C rounded to 4 decimals and H to 2, alpha only when < 1 (`/ 0.5`); deterministic. */
export function formatOklch(c: Oklch): string {
  const h = Number(c.h.toFixed(2)) % 360
  const alpha = c.alpha < 1 ? ` / ${round(c.alpha, 4)}` : ""
  return `oklch(${round(c.l, 4)} ${round(c.c, 4)} ${round(h, 2)}${alpha})`
}

// ---------------------------------------------------------------- parsing

const NAMED: Readonly<Record<string, string>> = Object.fromEntries(
  (
    "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc " +
    "bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a " +
    "burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 " +
    "cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b " +
    "darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 " +
    "darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 " +
    "darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f " +
    "darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 " +
    "darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 " +
    "dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff " +
    "gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 " +
    "greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c " +
    "indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 " +
    "lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff " +
    "lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 " +
    "lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa " +
    "lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 " +
    "lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 " +
    "mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db " +
    "mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a " +
    "mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa " +
    "mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 " +
    "olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 " +
    "palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 " +
    "papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 " +
    "purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 " +
    "saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee " +
    "sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 " +
    "slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 " +
    "thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff " +
    "whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32"
  )
    .split(" ")
    .flatMap((word, i, words) => (i % 2 === 0 ? [[word, `#${words[i + 1]}`]] : [])),
)

const NUM = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?`
const DIMENSION = new RegExp(`^(${NUM})([a-z%]*)$`)

interface Token {
  readonly value: number
  readonly unit: string
}

/** `none` parses as 0; anything that is not a number with an optional unit is rejected. */
function token(raw: string | undefined): Token | null {
  if (raw === undefined) return null
  if (raw === "none") return { value: 0, unit: "" }
  const m = DIMENSION.exec(raw)
  return m?.[1] === undefined ? null : { value: Number(m[1]), unit: m[2] ?? "" }
}

/** Number, or percentage scaled so that 100% = `full`. */
function scaled(raw: string | undefined, full: number): number | null {
  const t = token(raw)
  if (!t) return null
  if (t.unit === "") return t.value
  return t.unit === "%" ? (t.value / 100) * full : null
}

function angle(raw: string | undefined): number | null {
  const t = token(raw)
  if (!t) return null
  const perDeg: Readonly<Record<string, number>> = {
    "": 1,
    deg: 1,
    turn: 360,
    rad: 1 / DEG,
    grad: 0.9,
  }
  const k = perDeg[t.unit]
  return k === undefined ? null : t.value * k
}

const parseAlpha = (raw: string | undefined): number | null =>
  raw === undefined ? 1 : (scaled(raw, 1) ?? null)

function fromRgb255(r: number, g: number, b: number, alpha: number): Oklch {
  const u = (x: number) => clamp(x, 0, 255) / 255
  return rgbToOklch({ r: u(r), g: u(g), b: u(b), alpha: clamp(alpha, 0, 1) })
}

function parseHex(hex: string): Oklch | null {
  if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) return null
  const full = hex.length <= 4 ? [...hex].map((d) => d + d).join("") : hex
  const byte = (i: number) => Number.parseInt(full.slice(i, i + 2), 16)
  return fromRgb255(byte(0), byte(2), byte(4), full.length === 8 ? byte(6) / 255 : 1)
}

function hslToRgb255(h: number, s: number, l: number): [number, number, number] {
  const sat = clamp(s, 0, 1)
  const light = clamp(l, 0, 1)
  const f = (n: number) => {
    const k = (((n + h / 30) % 12) + 12) % 12
    return (
      255 * (light - sat * Math.min(light, 1 - light) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
    )
  }
  return [f(0), f(8), f(4)]
}

/** Split function arguments: legacy commas, or modern whitespace with an optional `/ alpha`. */
function splitArgs(body: string): string[] {
  if (body.includes(",")) return body.split(",").map((s) => s.trim())
  const [colour = "", alpha, ...rest] = body.split("/")
  if (rest.length > 0) return []
  const parts = colour.trim().split(/\s+/)
  return alpha === undefined ? parts : [...parts, alpha.trim()]
}

function parseFunction(name: string, args: string[]): Oklch | null {
  if (args.length !== 3 && args.length !== 4) return null
  const [x, y, z, a] = args
  const alpha = parseAlpha(a)
  if (alpha === null) return null
  const a1 = clamp(alpha, 0, 1)
  switch (name) {
    case "rgb":
    case "rgba": {
      const [r, g, b] = [scaled(x, 255), scaled(y, 255), scaled(z, 255)]
      return r === null || g === null || b === null ? null : fromRgb255(r, g, b, a1)
    }
    case "hsl":
    case "hsla": {
      // s and l are percent points: `50%` and the bare `50` (modern syntax) mean the same.
      const [h, s, l] = [angle(x), scaled(y, 100), scaled(z, 100)]
      return h === null || s === null || l === null
        ? null
        : fromRgb255(...hslToRgb255(h, s / 100, l / 100), a1)
    }
    case "oklch": {
      const [l, c, h] = [scaled(x, 1), scaled(y, 0.4), angle(z)]
      if (l === null || c === null || h === null) return null
      return { l: clamp(l, 0, 1), c: Math.max(0, c), h: ((h % 360) + 360) % 360, alpha: a1 }
    }
    case "oklab": {
      const [l, la, lb] = [scaled(x, 1), scaled(y, 0.4), scaled(z, 0.4)]
      return l === null || la === null || lb === null
        ? null
        : labToOklch([clamp(l, 0, 1), la, lb], a1)
    }
    default:
      return null
  }
}

export function parseColor(input: string): Oklch | null {
  const s = input.trim().toLowerCase()
  if (s === "transparent") return { l: 0, c: 0, h: 0, alpha: 0 }
  if (s.startsWith("#")) return parseHex(s.slice(1))
  const fn = /^([a-z]+)\((.*)\)$/s.exec(s)
  if (fn?.[1] !== undefined && fn[2] !== undefined)
    return parseFunction(fn[1], splitArgs(fn[2].trim()))
  const named = NAMED[s]
  return named === undefined ? null : parseHex(named.slice(1))
}
