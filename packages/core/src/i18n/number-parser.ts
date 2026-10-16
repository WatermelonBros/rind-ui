// number-parsing: text a user types or pastes into a number and back, for a locale and
// Intl.NumberFormat options. Wraps @internationalized/number (decision 0009; the parser
// React Aria, Zag, Reka and Kobalte share) and adds what it lacks: Persian digits, group
// separators and literal prefixes in partial input, no silent rounding, value text for
// assistive technology. The only module that imports the dependency.

import { NumberFormatter, NumberParser } from "@internationalized/number"
import { decimals } from "../components/shared/step-math"

export interface NumberParseOptions extends Intl.NumberFormatOptions {}

export interface LocaleNumberParser {
  /** The number the text means in the locale, or null (never a partial number). */
  parse(text: string): number | null
  /** Whether further typing could turn the text into a number. */
  isPartial(text: string, o?: { readonly allowNegative?: boolean }): boolean
  /**
   * The display text. Without fraction or rounding options nothing is rounded: as many
   * fraction digits as `value` and `step` need (up to 20).
   */
  format(value: number, o?: FormatOptions): string
  /** `format`, with U+2212 for every minus and accounting parentheses as a leading minus. */
  valueText(value: number, o?: FormatOptions): string
  /** The numbering system the text is written in (to keep it when reformatting). */
  numberingSystem(text: string): string | undefined
  /** The locale's decimal separator for these options. */
  readonly decimal: string
  /** Whether the options allow fraction digits at all (a decimal separator is typed). */
  readonly allowsFraction: boolean
  readonly resolved: Intl.ResolvedNumberFormatOptions
}

export interface FormatOptions {
  /** The field's step: its decimals are shown when the options set none. */
  readonly step?: number | undefined
  readonly numberingSystem?: string | undefined
}

const ROUNDING_KEYS = [
  "minimumFractionDigits",
  "maximumFractionDigits",
  "minimumSignificantDigits",
  "maximumSignificantDigits",
  "roundingIncrement",
  "roundingPriority",
] as const

/** Options compared by value: an equal object every render reuses the parser. */
const keyOf = (locale: string, options: object) =>
  `${locale}|${JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)))}`

const cache = new Map<string, LocaleNumberParser>()

// Persian (arabext) digits are not among the library's numbering systems.
const ARABEXT = /[۰-۹]/g
const fromArabext = (text: string) => text.replace(ARABEXT, (d) => String(d.charCodeAt(0) - 0x06f0))

/** The literal text around the digits of a formatted number (currency, unit, percent). */
function literals(nf: Intl.NumberFormat, value: number) {
  const parts = nf.formatToParts(value)
  const first = parts.findIndex((p) => p.type === "integer")
  let last = -1
  parts.forEach((p, i) => {
    if (p.type === "integer" || p.type === "fraction") last = i
  })
  const text = (from: number, to: number) =>
    parts
      .slice(from, to)
      .map((p) => p.value)
      .join("")
  return { prefix: text(0, first), suffix: text(last + 1, parts.length) }
}

const isPrefixOf = (part: string, whole: string) => part.length > 0 && whole.startsWith(part)

declare const process: { env: { NODE_ENV?: string } }

export function createNumberParser(
  locale: string,
  options: NumberParseOptions = {},
): LocaleNumberParser {
  const key = keyOf(locale, options)
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const made = build(locale, options)
    cache.set(key, made)
    return made
  } catch (e) {
    // Invalid options (an unknown unit or currency) must not crash the render: plain decimal.
    if (!(e instanceof RangeError)) throw e
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] number-parsing: invalid formatOptions ${JSON.stringify(options)} for "${locale}" (${e.message}); using a plain decimal format`,
      )
    }
    const fallback = createNumberParser(locale, {})
    cache.set(key, fallback)
    return fallback
  }
}

function build(locale: string, options: NumberParseOptions): LocaleNumberParser {
  const parser = new NumberParser(locale, options)
  const base = new Intl.NumberFormat(locale, options)
  const resolved = base.resolvedOptions()
  const rounds = ROUNDING_KEYS.some((k) => options[k] !== undefined)
  // Rounding options removed: they may forbid the one fraction digit this needs.
  const unrounded = Object.fromEntries(
    Object.entries(options).filter(([k]) => !(ROUNDING_KEYS as readonly string[]).includes(k)),
  )
  const decimal =
    new Intl.NumberFormat(locale, {
      ...unrounded,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
      .formatToParts(1.1)
      .find((p) => p.type === "decimal")?.value ?? "."
  const groups = new Set(
    new Intl.NumberFormat(locale, { ...options, useGrouping: true })
      .formatToParts(1234567.1)
      .filter((p) => p.type === "group")
      .map((p) => p.value),
  )
  const allowsFraction = (resolved.maximumFractionDigits ?? 3) > 0
  const formatters = new Map<string, NumberFormatter>()
  const formatter = (o: Intl.NumberFormatOptions) => {
    const k = JSON.stringify(o)
    let f = formatters.get(k)
    if (!f) {
      // The library's options type has no `undefined` members (exactOptionalPropertyTypes);
      // undefined entries are dropped, so the object is a valid NumberFormatOptions.
      const merged = Object.fromEntries(
        Object.entries({ ...options, ...o }).filter(([, v]) => v !== undefined),
      ) as ConstructorParameters<typeof NumberFormatter>[1]
      f = new NumberFormatter(locale, merged)
      formatters.set(k, f)
    }
    return f
  }
  const shown = (value: number, o: FormatOptions = {}) => {
    const extra: Intl.NumberFormatOptions = {}
    if (!rounds) {
      // No silent rounding (base-ui#5420): as many digits as the value and the step need.
      const percent = options.style === "percent" ? 2 : 0
      const digits = Math.max(decimals(o.step ?? 0), decimals(value) - percent, 0)
      extra.maximumFractionDigits = Math.min(
        20,
        Math.max(digits, resolved.minimumFractionDigits ?? 0),
      )
    }
    if (o.numberingSystem) extra.numberingSystem = o.numberingSystem
    return formatter(extra).format(value)
  }
  const { prefix, suffix } = literals(base, 1)
  const neg = literals(base, -1)

  const isPartialCore = (text: string, allowNegative: boolean) => {
    if (text === "") return true
    const min = allowNegative ? undefined : 0
    if (parser.isValidPartialNumber(text, min)) return true
    // Group separators anywhere, even leading (react-spectrum#5927).
    let stripped = text
    for (const g of groups) stripped = stripped.split(g).join("")
    if (stripped !== text && (stripped === "" || parser.isValidPartialNumber(stripped, min))) {
      return true
    }
    return false
  }

  const self: LocaleNumberParser = {
    decimal,
    allowsFraction,
    resolved,
    parse(text) {
      const t = fromArabext(text).trim()
      if (t === "") return null
      const n = parser.parse(t)
      return Number.isFinite(n) ? n : null
    },
    isPartial(text, o = {}) {
      const allowNegative = o.allowNegative !== false
      const t = fromArabext(text)
      // No fraction digits allowed: a decimal separator can never complete a number.
      if (!allowsFraction && t.includes(decimal)) return false
      if (isPartialCore(t, allowNegative)) return true
      // An incomplete literal (react-spectrum#2806, base-ui#5107): a prefix of the
      // currency / unit / percent text before or after the digits.
      const before = allowNegative ? [prefix, neg.prefix] : [prefix]
      if (before.some((p) => isPrefixOf(t, p) || isPrefixOf(t.trim(), p.trim()))) return true
      for (const s of allowNegative ? [suffix, neg.suffix] : [suffix]) {
        for (let i = 1; i < s.length; i++) {
          const tail = s.slice(0, i)
          if (t.endsWith(tail) && isPartialCore(t.slice(0, -tail.length), allowNegative)) {
            return true
          }
        }
      }
      return false
    },
    format: shown,
    valueText(value, o) {
      const text = shown(value, o)
      // Accounting parentheses read as a minus (react-spectrum#4160).
      const accounting = /^\((.*)\)$/.exec(text.trim())
      const signed = accounting ? `-${accounting[1]}` : text
      return signed.replace(/-/g, "−")
    },
    numberingSystem(text) {
      try {
        return parser.getNumberingSystem(fromArabext(text))
      } catch {
        return undefined
      }
    },
  }
  return self
}

/**
 * The keypad quirk (`keypad-decimal-separator`): a touch keypad inserts `.` or the
 * device's decimal separator whatever the field's locale; it means the field's decimal.
 */
export function keypadDecimal(
  inserted: string,
  field: LocaleNumberParser,
  deviceLocale: string,
): string {
  if (inserted.length !== 1 || inserted === field.decimal) return inserted
  const device = createNumberParser(deviceLocale).decimal
  return inserted === "." || inserted === device ? field.decimal : inserted
}
