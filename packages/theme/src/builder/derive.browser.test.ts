// add-theme-system 5.2: the TypeScript derivation equals what the live CSS derivation
// (tokens.css, relative colour syntax) computes in the browser, for 20 brand inputs.
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, files, inject, mount, q, resolve } from "../test-css"
import { inGamut, type Oklch, parseColor } from "./color"
import { type ColorInputs, deriveColors, type SemanticColorToken } from "./derive"

afterEach(cleanup)

interface Sample {
  readonly name: string
  readonly accent: string
  readonly neutral: string
  readonly danger?: string
  readonly warning?: string
  readonly success?: string
  readonly borderStrength?: number
}

const base = {
  danger: "oklch(0.55 0.2 27)",
  warning: "oklch(0.75 0.15 75)",
  success: "oklch(0.62 0.14 150)",
}
const samples: Sample[] = [
  { name: "calm", accent: "oklch(0.52 0.19 268)", neutral: "oklch(0.5 0.01 270)" },
  {
    name: "crisp",
    accent: "oklch(0.55 0.2 255)",
    neutral: "oklch(0.5 0.005 250)",
    borderStrength: 0.6,
  },
  { name: "light yellow", accent: "oklch(0.86 0.17 95)", neutral: "oklch(0.5 0.01 95)" },
  { name: "near white", accent: "oklch(0.98 0.01 200)", neutral: "oklch(0.97 0.005 200)" },
  { name: "near black", accent: "oklch(0.15 0.02 30)", neutral: "oklch(0.2 0.01 30)" },
  {
    name: "dark blue",
    accent: "oklch(0.3 0.12 260)",
    neutral: "oklch(0.4 0.02 260)",
    borderStrength: 1,
  },
  {
    name: "saturated red",
    accent: "oklch(0.63 0.26 29)",
    neutral: "oklch(0.5 0.03 29)",
    borderStrength: 0,
  },
  { name: "saturated green", accent: "oklch(0.8 0.25 145)", neutral: "oklch(0.5 0.02 145)" },
  { name: "magenta", accent: "oklch(0.61 0.25 330)", neutral: "oklch(0.5 0.01 330)" },
  { name: "cyan", accent: "oklch(0.75 0.12 200)", neutral: "oklch(0.5 0.015 200)" },
  {
    name: "orange",
    accent: "oklch(0.7 0.18 55)",
    neutral: "oklch(0.5 0.02 55)",
    borderStrength: 0.4,
  },
  { name: "purple", accent: "oklch(0.45 0.2 300)", neutral: "oklch(0.5 0.01 300)" },
  { name: "mid grey accent", accent: "oklch(0.62 0 0)", neutral: "oklch(0.55 0 0)" },
  { name: "threshold below", accent: "oklch(0.599 0.15 150)", neutral: "oklch(0.5 0.01 150)" },
  { name: "threshold above", accent: "oklch(0.601 0.15 150)", neutral: "oklch(0.5 0.01 150)" },
  { name: "high chroma neutral", accent: "oklch(0.5 0.1 20)", neutral: "oklch(0.5 0.12 20)" },
  { name: "low chroma neutral", accent: "oklch(0.55 0.15 120)", neutral: "oklch(0.5 0.004 120)" },
  { name: "hue 359", accent: "oklch(0.55 0.15 359)", neutral: "oklch(0.5 0.01 359)" },
  { name: "hue 1", accent: "oklch(0.55 0.15 1)", neutral: "oklch(0.5 0.01 1)", ...base },
  {
    name: "custom statuses",
    accent: "oklch(0.52 0.19 268)",
    neutral: "oklch(0.5 0.01 270)",
    danger: "oklch(0.4 0.15 15)",
    warning: "oklch(0.9 0.12 100)",
    success: "oklch(0.45 0.1 160)",
  },
]

const parse = (s: string): Oklch => {
  const c = parseColor(s)
  if (!c) throw new Error(`unparsable ${s}`)
  return c
}

/** A computed colour in whichever syntax the engine prints (oklch(), rgb(), color(srgb …)). */
function parseComputed(s: string): Oklch {
  const direct = parseColor(s)
  if (direct) return direct
  const m = /^color\(srgb ([^)]+)\)$/.exec(s.trim())
  if (m?.[1]) {
    const [r = 0, g = 0, b = 0, a = 1] = m[1].split(/[\s/]+/).map(Number)
    const hex = (v: number) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0")
    // 8-bit precision only: callers loosen nothing, so engines printing this form fail loudly.
    return { ...parse(`#${hex(r)}${hex(g)}${hex(b)}`), alpha: a }
  }
  throw new Error(`cannot parse computed colour ${s}`)
}

const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

const cssName = (token: SemanticColorToken) =>
  token === "focus-color" ? "--rind-focus-color" : `--rind-color-${token}`

describe("TypeScript derivation equals the live CSS derivation", () => {
  // BUG (tokens.css, solid-hover): at a palette lightness of exactly 0.6 the CSS step
  // `l - 0.05 * clamp(-1, (0.6 - l) * 1000, 1)` is 0, so solid-hover === solid, while the
  // builder (derive.ts paletteRoles: `p.l < 0.6 ? l - 0.05 : l + 0.05`) lightens it by 0.05.
  // calm's own success colour (oklch(0.6 0.14 150)) is exactly on the threshold.
  it("a palette at exactly L 0.6 (calm success)", () => {
    inject(files.tokens)
    const host = mount(
      `<div data-rind-theme="probe" style="color-scheme: light; --rind-brand-success: oklch(0.6 0.14 150)"></div>`,
    )
    const solid = parseComputed(resolve(q(host, "div"), "color", "--rind-color-success-solid"))
    const hover = parseComputed(
      resolve(q(host, "div"), "color", "--rind-color-success-solid-hover"),
    )
    const ts = deriveColors(
      {
        accent: parse("oklch(0.52 0.19 268)"),
        neutral: parse("oklch(0.5 0.01 270)"),
        danger: parse("oklch(0.55 0.2 27)"),
        warning: parse("oklch(0.75 0.15 75)"),
        success: parse("oklch(0.6 0.14 150)"),
        borderStrength: 0.2,
      },
      "light",
    )["success-solid-hover"]
    expect(Math.abs(hover.l - ts.l)).toBeLessThanOrEqual(0.01)
    expect(Math.abs(hover.l - solid.l)).toBeGreaterThan(0)
  })

  it.each(samples)("$name", (sample) => {
    inject(files.tokens)
    const strength = sample.borderStrength ?? 0.2
    const full = { ...base, ...sample }
    const input: ColorInputs = {
      accent: parse(full.accent),
      neutral: parse(full.neutral),
      danger: parse(full.danger),
      warning: parse(full.warning),
      success: parse(full.success),
      borderStrength: strength,
    }
    let compared = 0
    for (const scheme of ["light", "dark"] as const) {
      const host = mount(
        `<div data-rind-theme="probe" style="color-scheme: ${scheme}; --rind-brand-accent: ${full.accent}; --rind-brand-neutral: ${full.neutral}; --rind-brand-danger: ${full.danger}; --rind-brand-warning: ${full.warning}; --rind-brand-success: ${full.success}; --rind-brand-border-strength: ${strength}"></div>`,
      )
      const el = q(host, "div")
      const expected = deriveColors(input, scheme)
      for (const token of Object.keys(expected) as SemanticColorToken[]) {
        const want = expected[token]
        const got = parseComputed(resolve(el, "color", cssName(token)))
        const where = `${scheme} ${token}: css ${resolve(el, "color", cssName(token))} vs ts oklch(${want.l} ${want.c} ${want.h})`
        expect(Math.abs(got.l - want.l), where).toBeLessThanOrEqual(0.01)
        // The builder gamut-maps (chroma only); the browser keeps out-of-sRGB values as given.
        // Lightness and hue are compared always, chroma only where the CSS value is in gamut.
        if (inGamut(got)) expect(Math.abs(got.c - want.c), where).toBeLessThanOrEqual(0.01)
        // Hue is noise for greys.
        if (want.c > 0.01 && got.c > 0.01) {
          expect(hueDiff(got.h, want.h), where).toBeLessThanOrEqual(2)
        }
        expect(Math.abs(got.alpha - want.alpha), where).toBeLessThanOrEqual(0.01)
        compared++
      }
    }
    // Most tokens must actually be compared, or the gamut skip hides everything.
    expect(compared).toBeGreaterThan(60)
  })
})
