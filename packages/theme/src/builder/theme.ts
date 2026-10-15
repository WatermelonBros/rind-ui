// defineTheme / checkTheme: brand inputs → validated, precomputed theme CSS. Pure TS, no DOM,
// no dependency, deterministic: the same input always gives the same bytes.

import { formatOklch, type Oklch, parseColor } from "./color"
import {
  type ColorInputs,
  type ColorTokens,
  deriveColors,
  type Scheme,
  type SemanticColorToken,
} from "./derive"
import { calm, crisp } from "./presets"
import {
  type Adjustment,
  type ContrastPair,
  correct,
  measure,
  nearestPassing,
  settleOnSolid,
} from "./validate"

/** The twelve brand inputs, camel-cased. Colours accept any CSS `<color>`. */
export interface BrandInputs {
  readonly accent: string
  readonly neutral: string
  readonly danger: string
  readonly warning: string
  readonly success: string
  readonly fontSans: string
  readonly fontMono: string
  /** A `rem` length, e.g. "0.875rem". */
  readonly fontSize: string
  /** A length, e.g. "0.5rem" or "0". */
  readonly radius: string
  /** 0.75–1.25. */
  readonly density: number
  /** 0–1. */
  readonly motion: number
  /** 0–1. */
  readonly borderStrength: number
}

type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Capitalize<Camel<B>>}` : S
/** Semantic colour tokens by camel-case role name (`accentText`, `textMuted`, `bg`). */
export type SemanticOverrideKey = Camel<SemanticColorToken>
export type ColorValue = string | { readonly light: string; readonly dark: string }

/**
 * Component token overrides by component scope and camel-case token name. The keys come
 * from the generated token manifest (`ComponentTokens`), so a typo fails to compile.
 */
export type ComponentOverrides = [keyof ComponentTokens] extends [never]
  ? // No component stylesheet yet: any scope is unknown.
    Readonly<Record<string, never>>
  : { readonly [S in keyof ComponentTokens]?: { readonly [T in ComponentTokens[S]]?: string } }
/** Generated from the component stylesheets (scripts/token-manifest.ts). */
export type { ComponentTokens } from "./components.generated"

import type { ComponentTokens } from "./components.generated"

export type PresetName = "calm" | "crisp"

export interface ThemeInput<Name extends string = string> extends Partial<BrandInputs> {
  /** Lowercase letters, digits and dashes, starting with a letter. */
  readonly name: Name extends Lowercase<Name> ? Name : Lowercase<Name>
  /** Inputs not given come from here (default `calm`). */
  readonly extends?: PresetName | ThemeDefinition
  readonly overrides?: { readonly [K in SemanticOverrideKey]?: ColorValue }
  readonly components?: ComponentOverrides
  /** `strict` (default) throws on a failing pair; `adjust` applies the suggestions. */
  readonly contrast?: "strict" | "adjust"
  /** Also target `:root` (the default theme of a page). */
  readonly root?: boolean
}

/** Any theme input once its literal name type no longer matters. */
type PlainInput = Omit<ThemeInput, "name"> & { readonly name: string }

export interface ContrastReport {
  readonly ok: boolean
  readonly pairs: readonly ContrastPair[]
  readonly adjusted: readonly Adjustment[]
  /** Component overrides are applied as given and not checked. */
  readonly unchecked: readonly string[]
}

export interface ThemeTokens {
  readonly brand: BrandInputs
  readonly colors: {
    readonly [K in SemanticColorToken]: { readonly light: string; readonly dark: string }
  }
  readonly scales: Readonly<Record<string, string>>
}

export interface ThemeDefinition {
  readonly name: string
  readonly css: string
  readonly tokens: ThemeTokens
  readonly report: ContrastReport
  /** Design Tokens Format Module (2025.10) JSON. */
  toDTCG(): DTCGDocument
  /** The resolved inputs (what `extends` reuses). */
  readonly inputs: BrandInputs
}

export type DTCGDocument = { readonly [key: string]: DTCGNode }
export type DTCGNode =
  | { readonly $type: string; readonly $value: unknown; readonly $description?: string }
  | { readonly [key: string]: DTCGNode }

export class ThemeInputError extends Error {
  readonly key: string
  readonly reason: string
  constructor(key: string, reason: string) {
    super(`[rind-ui/theme] ${key}: ${reason}`)
    this.name = "ThemeInputError"
    this.key = key
    this.reason = reason
  }
}

export class ThemeContrastError extends Error {
  readonly report: ContrastReport
  constructor(report: ContrastReport) {
    const failing = report.pairs.filter((p) => !p.pass)
    super(
      `[rind-ui/theme] ${failing.length} contrast pair(s) fail:\n${failing
        .map(
          (p) =>
            `  ${p.scheme}: ${p.foreground} on ${p.background} ${p.ratio}:1 (needs ${p.required}:1)${p.suggestion ? `, try ${p.suggestion}` : ""}`,
        )
        .join("\n")}`,
    )
    this.name = "ThemeContrastError"
    this.report = report
  }
}

const PRESETS: Record<PresetName, BrandInputs> = { calm, crisp }
const BRAND_KEYS = Object.keys(calm) as (keyof BrandInputs)[]
const NAME = /^[a-z][a-z0-9-]*$/
/** Quoted family names and identifiers, comma separated: nothing that can end a rule. */
const FONT =
  /^\s*(?:"[^"\\<>{};]*"|'[^'\\<>{};]*'|-?[A-Za-z][A-Za-z0-9 -]*)(?:\s*,\s*(?:"[^"\\<>{};]*"|'[^'\\<>{};]*'|-?[A-Za-z][A-Za-z0-9 -]*))*\s*$/
const LENGTH = /^(?:0|\d*\.?\d+(?:px|rem|em))$/
const REM = /^\d*\.?\d+rem$/
const ALLOWED = new Set([
  ...BRAND_KEYS,
  "name",
  "extends",
  "overrides",
  "components",
  "contrast",
  "root",
])

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const round = (n: number, digits = 4) => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function color(key: string, value: unknown): Oklch {
  const parsed = typeof value === "string" ? parseColor(value) : null
  if (!parsed) throw new ThemeInputError(key, `not a CSS colour: ${String(value)}`)
  return parsed
}

function range(key: string, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ThemeInputError(key, `must be a number from ${min} to ${max}, got ${String(value)}`)
  }
  return value
}

/** The inputs of `extends`, then the given ones, validated. */
function resolveInputs(input: PlainInput): BrandInputs {
  for (const key of Object.keys(input)) {
    if (!ALLOWED.has(key)) throw new ThemeInputError(key, "unknown input")
  }
  if (typeof input.name !== "string" || !NAME.test(input.name)) {
    throw new ThemeInputError("name", "must match ^[a-z][a-z0-9-]*$")
  }
  const ext = input.extends ?? "calm"
  const base = typeof ext === "string" ? PRESETS[ext] : ext.inputs
  if (!base) throw new ThemeInputError("extends", `unknown preset: ${String(ext)}`)
  const merged: BrandInputs = { ...base }
  const out = { ...merged } as { -readonly [K in keyof BrandInputs]: BrandInputs[K] }
  for (const key of BRAND_KEYS) {
    const v = input[key]
    if (v !== undefined) (out as Record<string, unknown>)[key] = v
  }
  for (const key of ["accent", "neutral", "danger", "warning", "success"] as const)
    color(key, out[key])
  for (const key of ["fontSans", "fontMono"] as const) {
    if (typeof out[key] !== "string" || !FONT.test(out[key])) {
      throw new ThemeInputError(key, "must be a font-family list of quoted names and identifiers")
    }
  }
  if (typeof out.fontSize !== "string" || !REM.test(out.fontSize)) {
    throw new ThemeInputError("fontSize", "must be a rem length, e.g. 0.875rem")
  }
  if (typeof out.radius !== "string" || !LENGTH.test(out.radius)) {
    throw new ThemeInputError("radius", "must be a length in px, rem or em, or 0")
  }
  range("density", out.density, 0.75, 1.25)
  range("motion", out.motion, 0, 1)
  range("borderStrength", out.borderStrength, 0, 1)
  return out
}

const colorInputs = (i: BrandInputs): ColorInputs => ({
  accent: color("accent", i.accent),
  neutral: color("neutral", i.neutral),
  danger: color("danger", i.danger),
  warning: color("warning", i.warning),
  success: color("success", i.success),
  borderStrength: i.borderStrength,
})

/** Semantic overrides, per scheme. */
function applyOverrides(
  tokens: ColorTokens,
  scheme: Scheme,
  overrides: PlainInput["overrides"],
): Set<SemanticColorToken> {
  const locked = new Set<SemanticColorToken>()
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const token = kebab(key) as SemanticColorToken
    if (!(token in tokens)) throw new ThemeInputError(`overrides.${key}`, "unknown semantic token")
    const v = typeof value === "string" ? value : (value as { light: string; dark: string })[scheme]
    tokens[token] = color(`overrides.${key}`, v)
    locked.add(token)
  }
  return locked
}

interface Built {
  readonly inputs: BrandInputs
  readonly colors: Record<Scheme, ColorTokens>
  readonly report: ContrastReport
}

function build(input: PlainInput, apply: boolean): Built {
  const inputs = resolveInputs(input)
  const ci = colorInputs(inputs)
  const colors = {} as Record<Scheme, ColorTokens>
  const pairs: ContrastPair[] = []
  const adjusted: Adjustment[] = []
  for (const scheme of ["light", "dark"] as const) {
    let tokens = deriveColors(ci, scheme)
    const locked = applyOverrides(tokens, scheme, input.overrides)
    // On-solid by real luminance, and the hover away from it: the derivation, not an adjustment.
    tokens = settleOnSolid(tokens, locked)
    const { tokens: corrected, changes } = correct(tokens, locked)
    const measured = measure(tokens, scheme)
    // Suggestions for the pairs that still fail.
    for (const p of measured) {
      if (p.pass) {
        pairs.push(p)
        continue
      }
      // On-solid fails on both white and black: the solid moves (the corrected one). Any
      // other pair: the nearest passing shade of its foreground against this background.
      const suggestion = p.foreground.endsWith("-on-solid")
        ? corrected[p.background] !== tokens[p.background]
          ? corrected[p.background]
          : null
        : nearestPassing(tokens[p.foreground], [tokens[p.background]], p.required)
      pairs.push(suggestion ? { ...p, suggestion: formatOklch(suggestion) } : p)
    }
    if (apply) {
      for (const [token, value] of changes) {
        if (formatOklch(value) === formatOklch(tokens[token])) continue
        adjusted.push({ scheme, token, from: formatOklch(tokens[token]), to: formatOklch(value) })
      }
      tokens = corrected
    }
    colors[scheme] = tokens
  }
  const final = apply ? (["light", "dark"] as const).flatMap((s) => measure(colors[s], s)) : pairs
  const unchecked = Object.entries(input.components ?? {}).flatMap(([scope, tokens]) =>
    Object.keys(tokens ?? {}).map((t) => `--rind-${scope}-${kebab(t)}`),
  )
  return {
    inputs,
    colors,
    report: { ok: final.every((p) => p.pass), pairs: apply ? final : pairs, adjusted, unchecked },
  }
}

function scales(i: BrandInputs): Record<string, string> {
  const d = i.density
  const fs = Number.parseFloat(i.fontSize)
  const r = Number.parseFloat(i.radius)
  const unit = i.radius.replace(/^[\d.]+/, "") || "px"
  const rem = (n: number) => `${round(n)}rem`
  const len = (n: number) => (r === 0 ? "0" : `${round(n)}${unit}`)
  return {
    "space-1": rem(0.25 * d),
    "space-2": rem(0.5 * d),
    "space-3": rem(0.75 * d),
    "space-4": rem(1 * d),
    "space-6": rem(1.5 * d),
    "space-8": rem(2 * d),
    "size-sm": `max(24px, ${rem(1.75 * d)})`,
    "size-md": `max(24px, ${rem(2 * d)})`,
    "size-lg": `max(24px, ${rem(2.5 * d)})`,
    "text-xs": rem(fs * 0.8571),
    "text-sm": rem(fs),
    "text-md": rem(fs * 1.1429),
    "text-lg": rem(fs * 1.2857),
    "radius-sm": len(r * 0.5),
    "radius-md": len(r),
    "radius-lg": len(r * 1.5),
    "duration-fast": `${round(90 * i.motion, 2)}ms`,
    "duration-normal": `${round(180 * i.motion, 2)}ms`,
    "duration-slow": `${round(280 * i.motion, 2)}ms`,
  }
}

function css(name: string, root: boolean, b: Built, components: ComponentOverrides | undefined) {
  const selector = root
    ? // A root that names another theme is that theme's scope, whatever the load order.
      `:where(:root:not([data-rind-theme]), [data-rind-theme="${name}"])`
    : `:where([data-rind-theme="${name}"])`
  const lines: string[] = []
  const i = b.inputs
  for (const key of ["accent", "neutral", "danger", "warning", "success"] as const) {
    lines.push(`--rind-brand-${kebab(key)}: ${formatOklch(color(key, i[key]))};`)
  }
  lines.push(`--rind-brand-font-sans: ${i.fontSans};`)
  lines.push(`--rind-brand-font-mono: ${i.fontMono};`)
  lines.push(`--rind-brand-font-size: ${i.fontSize};`)
  lines.push(`--rind-brand-radius: ${i.radius};`)
  lines.push(`--rind-brand-density: ${i.density};`)
  lines.push(`--rind-brand-motion: ${i.motion};`)
  lines.push(`--rind-brand-border-strength: ${i.borderStrength};`)
  for (const [k, v] of Object.entries(scales(i))) lines.push(`--rind-${k}: ${v};`)
  for (const token of Object.keys(b.colors.light) as SemanticColorToken[]) {
    if (token === "focus-color") continue
    const light = formatOklch(b.colors.light[token])
    const dark = formatOklch(b.colors.dark[token])
    lines.push(
      `--rind-color-${token}: ${light === dark ? light : `light-dark(${light}, ${dark})`};`,
    )
  }
  for (const [scope, tokens] of Object.entries(components ?? {}).sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    for (const [t, v] of Object.entries(tokens ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (typeof v !== "string" || /[;{}<>]|url\(|@import|expression/i.test(v)) {
        throw new ThemeInputError(`components.${scope}.${t}`, "unsafe value")
      }
      lines.push(`--rind-${scope}-${kebab(t)}: ${v};`)
    }
  }
  const main = `@layer rind.themes {\n  ${selector} {\n${lines.map((l) => `    ${l}`).join("\n")}\n  }\n}\n`
  // The focus colour lives in rind.preferences (no theme undoes it): a focus colour that is
  // not the accent border (an override, an adjustment) is declared there for this scope.
  const focus = (["light", "dark"] as const).map((s) => formatOklch(b.colors[s]["focus-color"]))
  const border = (["light", "dark"] as const).map((s) => formatOklch(b.colors[s]["accent-border"]))
  if (focus[0] === border[0] && focus[1] === border[1]) return main
  const value = focus[0] === focus[1] ? focus[0] : `light-dark(${focus[0]}, ${focus[1]})`
  return `${main}@layer rind.preferences {\n  ${selector} {\n    --rind-focus-color: ${value};\n  }\n}\n`
}

function definition(input: PlainInput, b: Built): ThemeDefinition {
  const colors = {} as Record<SemanticColorToken, { light: string; dark: string }>
  for (const token of Object.keys(b.colors.light) as SemanticColorToken[]) {
    colors[token] = {
      light: formatOklch(b.colors.light[token]),
      dark: formatOklch(b.colors.dark[token]),
    }
  }
  const tokens: ThemeTokens = { brand: b.inputs, colors, scales: scales(b.inputs) }
  const text = css(input.name, input.root === true, b, input.components)
  return {
    name: input.name,
    css: text,
    tokens,
    report: b.report,
    inputs: b.inputs,
    toDTCG: () => toDTCG(tokens, b.inputs),
  }
}

/** DTCG colour value from an `oklch(L C H)` string. */
function dtcgColor(oklch: string) {
  const [l = 0, c = 0, h = 0] = (/oklch\(([^)]+)\)/.exec(oklch)?.[1] ?? "")
    .split(/[\s/]+/)
    .map(Number)
  return { colorSpace: "oklch", components: [l, c, h] }
}

function toDTCG(tokens: ThemeTokens, inputs: BrandInputs): DTCGDocument {
  const brand: Record<string, DTCGNode> = {}
  const brandOklch: Record<string, string> = {}
  for (const key of ["accent", "neutral", "danger", "warning", "success"] as const) {
    const v = formatOklch(color(key, inputs[key]))
    brandOklch[key] = v
    brand[key] = { $type: "color", $value: dtcgColor(v) }
  }
  brand["fontSans"] = { $type: "fontFamily", $value: inputs.fontSans }
  brand["fontMono"] = { $type: "fontFamily", $value: inputs.fontMono }
  brand["radius"] = { $type: "dimension", $value: inputs.radius }
  const scheme = (s: Scheme) => {
    const group: Record<string, DTCGNode> = {}
    for (const [token, pair] of Object.entries(tokens.colors)) {
      const palette = token.split("-")[0] ?? ""
      // Tier 2 aliases tier 1 where it was not adjusted (the solid of each palette).
      const alias = token.endsWith("-solid") && brandOklch[palette] === pair[s]
      group[token] = { $type: "color", $value: alias ? `{brand.${palette}}` : dtcgColor(pair[s]) }
    }
    return group
  }
  return { brand, light: scheme("light"), dark: scheme("dark") }
}

/** Builds a validated theme. Strict mode throws `ThemeContrastError` when a pair fails. */
export function defineTheme<const Name extends string>(input: ThemeInput<Name>): ThemeDefinition {
  const b = build(input, input.contrast === "adjust")
  if (!b.report.ok) throw new ThemeContrastError(b.report)
  return definition(input, b)
}

/** The contrast report only, never throwing for contrast (an editor's live feedback). */
export function checkTheme<const Name extends string>(input: ThemeInput<Name>): ContrastReport {
  return build(input, false).report
}
