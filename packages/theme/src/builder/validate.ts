// WCAG 2 contrast checks on the derived colours (the pairs of theme-builder "Contrast
// Validation"), the nearest passing shade for a failing pair, and the adjust pass.

import { contrast, gamutMap, type Oklch } from "./color"
import {
  type ColorTokens,
  PALETTES,
  type Palette,
  type Scheme,
  type SemanticColorToken,
} from "./derive"

export interface ContrastPair {
  readonly scheme: Scheme
  readonly foreground: SemanticColorToken
  readonly background: SemanticColorToken
  /** Rounded to 2 decimals. */
  readonly ratio: number
  readonly required: 3 | 4.5
  readonly pass: boolean
  /** The nearest passing colour for the token that would change (failing pairs only). */
  readonly suggestion?: string
}

export interface Adjustment {
  readonly scheme: Scheme
  readonly token: SemanticColorToken
  readonly from: string
  readonly to: string
}

interface PairSpec {
  readonly foreground: SemanticColorToken
  readonly background: SemanticColorToken
  readonly required: 3 | 4.5
}

/** Every checked pair (text-disabled, border and overlay are exempt). */
export const PAIRS: readonly PairSpec[] = (() => {
  const out: PairSpec[] = []
  const grounds = ["bg", "surface", "surface-raised"] as const
  for (const fg of ["text", "text-muted"] as const) {
    for (const bg of grounds) out.push({ foreground: fg, background: bg, required: 4.5 })
  }
  for (const p of PALETTES) {
    for (const bg of [`${p}-solid`, `${p}-solid-hover`] as const) {
      out.push({ foreground: `${p}-on-solid`, background: bg, required: 4.5 })
    }
    for (const bg of [...grounds, `${p}-soft`, `${p}-soft-hover`] as const) {
      out.push({ foreground: `${p}-text`, background: bg, required: 4.5 })
    }
  }
  for (const fg of ["border-strong", ...PALETTES.map((p) => `${p}-border` as const)] as const) {
    for (const bg of ["bg", "surface"] as const)
      out.push({ foreground: fg, background: bg, required: 3 })
  }
  for (const bg of grounds) out.push({ foreground: "focus-color", background: bg, required: 3 })
  return out
})()

const round2 = (n: number) => Math.round(n * 100) / 100
/** A small margin over the requirement so rounding to 4 decimals cannot fall below it. */
const MARGIN = 0.02

/** `c` at lightness `l` (same hue), chroma reduced only as needed to stay in gamut. */
const atLightness = (c: Oklch, l: number): Oklch => gamutMap({ ...c, l })

/**
 * The colour of `fg`'s hue whose lightness is closest to `fg`'s and which reaches `required`
 * against every background; null when no lightness does.
 */
export function nearestPassing(
  fg: Oklch,
  backgrounds: readonly Oklch[],
  required: number,
): Oklch | null {
  const passes = (l: number) =>
    backgrounds.every((bg) => contrast(atLightness(fg, l), bg) >= required + MARGIN)
  let best: Oklch | null = null
  for (const extreme of [0, 1]) {
    if (!passes(extreme)) continue
    // Bisection between the failing lightness and the passing extreme.
    let fail = fg.l
    let pass = extreme
    for (let i = 0; i < 40; i++) {
      const mid = (fail + pass) / 2
      if (passes(mid)) pass = mid
      else fail = mid
    }
    const candidate = atLightness(fg, pass)
    if (!best || Math.abs(candidate.l - fg.l) < Math.abs(best.l - fg.l)) best = candidate
  }
  return best
}

/** The pairs of one scheme, measured. */
export function measure(tokens: ColorTokens, scheme: Scheme): ContrastPair[] {
  return PAIRS.map(({ foreground, background, required }) => {
    const ratio = contrast(tokens[foreground], tokens[background])
    return {
      scheme,
      foreground,
      background,
      ratio: round2(ratio),
      required,
      pass: ratio >= required,
    }
  })
}

const backgroundsOf = (fg: SemanticColorToken) =>
  PAIRS.filter((p) => p.foreground === fg).map((p) => ({ bg: p.background, required: p.required }))

const ON_WHITE = (h: number): Oklch => ({ l: 1, c: 0, h, alpha: 1 })
const ON_DARK = (h: number): Oklch => ({ l: 0.18, c: 0, h, alpha: 1 })

/** The hover of a solid: a lightness step away from its on-solid text. */
const hoverOf = (solid: Oklch, on: Oklch) =>
  atLightness(solid, on.l > solid.l ? solid.l - 0.05 : solid.l + 0.05)

/**
 * The derivation's on-solid, by real luminance: white or near-black, whichever reads better
 * on the solid; then the hover a step away from that text (never towards it). Not an
 * adjustment: it is how built themes derive, and overridden tokens are kept.
 */
export function settleOnSolid(
  tokens: ColorTokens,
  locked: ReadonlySet<SemanticColorToken>,
): ColorTokens {
  const next: ColorTokens = { ...tokens }
  for (const p of PALETTES as readonly Palette[]) {
    const solid = next[`${p}-solid`]
    if (!locked.has(`${p}-on-solid`)) {
      const options = [ON_WHITE(solid.h), ON_DARK(solid.h)]
      next[`${p}-on-solid`] = options.reduce((a, b) =>
        contrast(b, solid) > contrast(a, solid) ? b : a,
      )
    }
    if (!locked.has(`${p}-solid-hover`)) {
      next[`${p}-solid-hover`] = hoverOf(solid, next[`${p}-on-solid`])
    }
  }
  return next
}

/**
 * Corrections for one scheme (after `settleOnSolid`): when neither white nor black text
 * reaches 4.5:1 on a solid, the `solid` itself changes.
 * Every other failing foreground moves to its nearest passing shade against all its
 * backgrounds. Returns the corrected tokens and what changed.
 */
export function correct(
  tokens: ColorTokens,
  locked: ReadonlySet<SemanticColorToken>,
): { tokens: ColorTokens; changes: Map<SemanticColorToken, Oklch> } {
  const next: ColorTokens = { ...tokens }
  const changes = new Map<SemanticColorToken, Oklch>()
  const set = (token: SemanticColorToken, value: Oklch) => {
    next[token] = value
    changes.set(token, value)
  }
  for (const p of PALETTES as readonly Palette[]) {
    const on = next[`${p}-on-solid`]
    const worst = () =>
      Math.min(contrast(on, next[`${p}-solid`]), contrast(on, next[`${p}-solid-hover`]))
    if (worst() >= 4.5) continue
    // Neither white nor black text passes: the solid moves to the nearest lightness that
    // does, and its hover follows (a step away from the text).
    const fixed = nearestPassing(next[`${p}-solid`], [on], 4.5)
    if (!fixed) continue
    set(`${p}-solid`, fixed)
    const shifted = hoverOf(fixed, on)
    set(`${p}-solid-hover`, contrast(on, shifted) >= 4.5 ? shifted : fixed)
  }
  const foregrounds = [...new Set(PAIRS.map((p) => p.foreground))].filter(
    (fg) => !fg.endsWith("-on-solid"),
  )
  // Overridden foregrounds are corrected too (adjust applies every suggestion); `locked`
  // only stops the automatic on-solid choice from replacing an overridden on-solid.
  for (const fg of foregrounds) {
    const specs = backgroundsOf(fg)
    const required = Math.max(...specs.map((s) => s.required))
    const failing = specs.some((s) => contrast(next[fg], next[s.bg]) < s.required)
    if (!failing) continue
    const fixed = nearestPassing(
      next[fg],
      specs.map((s) => next[s.bg]),
      required,
    )
    if (fixed) set(fg, fixed)
  }
  // Focus follows the accent border unless the border itself moved.
  if (changes.has("accent-border") && !locked.has("focus-color")) {
    next["focus-color"] = next["accent-border"]
  }
  return { tokens: next, changes }
}
