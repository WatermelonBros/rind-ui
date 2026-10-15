// The derivation of design D2, in TypeScript: the same constants as tokens.css, so a built
// theme paints what a live scope would, except that the builder can gamut-map, measure and
// correct. Pure: no DOM, no globals.

import { gamutMap, type Oklch } from "./color"

export type Scheme = "light" | "dark"
export const PALETTES = ["accent", "neutral", "danger", "warning", "success"] as const
export type Palette = (typeof PALETTES)[number]
export const ROLES = [
  "solid",
  "solid-hover",
  "on-solid",
  "soft",
  "soft-hover",
  "text",
  "border",
] as const
export type Role = (typeof ROLES)[number]
export const SURFACES = [
  "bg",
  "surface",
  "surface-raised",
  "overlay",
  "text",
  "text-muted",
  "text-disabled",
  "border",
  "border-strong",
] as const
export type Surface = (typeof SURFACES)[number]

/** A semantic colour token name without the `--rind-color-` prefix (`accent-text`, `bg`). */
export type SemanticColorToken = Surface | `${Palette}-${Role}` | "focus-color"

export type ColorTokens = Record<SemanticColorToken, Oklch>

const NEUTRAL_L: Record<Exclude<Surface, "border">, readonly [number, number]> = {
  bg: [0.968, 0.185],
  surface: [0.94, 0.215],
  "surface-raised": [0.993, 0.25],
  overlay: [0.15, 0.05],
  text: [0.2, 0.93],
  "text-muted": [0.47, 0.71],
  "text-disabled": [0.64, 0.47],
  "border-strong": [0.58, 0.53],
}

const at = (scheme: Scheme, pair: readonly [number, number]) =>
  scheme === "light" ? pair[0] : pair[1]

/** Neutral chroma: capped at 0.03, and 0 below 0.005 (the hue is noise there). */
const neutralChroma = (c: number) => (c < 0.005 ? 0 : Math.min(c, 0.03))

/** The seven roles of one palette, as tokens.css derives them (before gamut mapping). */
export function paletteRoles(p: Oklch, scheme: Scheme): Record<Role, Oklch> {
  const light = scheme === "light"
  const of = (l: number, c: number): Oklch => ({ l, c, h: p.h, alpha: 1 })
  return {
    solid: of(p.l, p.c),
    // A step away from the on-solid text, so hover keeps its contrast in both schemes.
    "solid-hover": of(p.l < 0.6 ? p.l - 0.05 : p.l + 0.05, p.c),
    // White below L 0.6, near-black above (the builder then checks real luminance).
    "on-solid": p.l < 0.6 ? of(1, 0) : of(0.18, 0),
    // Dark tints carry more chroma: at low lightness a capped tint reads as mud.
    soft: of(light ? 0.93 : 0.29, Math.min(p.c, light ? 0.045 : 0.07)),
    "soft-hover": of(light ? 0.895 : 0.33, Math.min(p.c, light ? 0.045 : 0.07)),
    text: of(light ? Math.min(p.l, 0.46) : Math.max(p.l, 0.78), Math.min(p.c, 0.2)),
    border: of(light ? Math.min(p.l, 0.6) : Math.max(p.l, 0.62), p.c),
  }
}

export interface ColorInputs {
  readonly accent: Oklch
  readonly neutral: Oklch
  readonly danger: Oklch
  readonly warning: Oklch
  readonly success: Oklch
  readonly borderStrength: number
}

/** Every semantic colour of one scheme, gamut-mapped to sRGB. */
export function deriveColors(input: ColorInputs, scheme: Scheme): ColorTokens {
  const nc = neutralChroma(input.neutral.c)
  const n = (l: number, alpha = 1): Oklch => ({ l, c: nc, h: input.neutral.h, alpha })
  const out: Partial<Record<SemanticColorToken, Oklch>> = {}
  for (const [name, pair] of Object.entries(NEUTRAL_L) as [
    Exclude<Surface, "border">,
    readonly [number, number],
  ][]) {
    out[name] = n(at(scheme, pair), name === "overlay" ? (scheme === "light" ? 0.45 : 0.6) : 1)
  }
  const s = input.borderStrength
  out.border = n(scheme === "light" ? 0.92 - 0.3 * s : 0.3 + 0.25 * s)
  const sources: Record<Palette, Oklch> = {
    accent: input.accent,
    neutral: { ...input.neutral, c: nc },
    danger: input.danger,
    warning: input.warning,
    success: input.success,
  }
  for (const palette of PALETTES) {
    const roles = paletteRoles(sources[palette], scheme)
    for (const role of ROLES) out[`${palette}-${role}`] = roles[role]
    // Focus is the accent border (theme-accessibility).
    if (palette === "accent") out["focus-color"] = roles.border
  }
  const mapped = {} as ColorTokens
  for (const [k, v] of Object.entries(out) as [SemanticColorToken, Oklch][]) mapped[k] = gamutMap(v)
  return mapped
}
