// date-segments "Typing And Auto-Advance" and "Day Period And Era Typing": what one typed
// character does to the focused segment. Digits in any numbering system the locale parser
// accepts (Latin, full width, the locale's); the buffer is the segment's typed text, so a
// leading zero shows and drives auto-advance. Pure.

import { createNumberParser } from "../../i18n/number-parser"
import { type Draft, limits, type SegmentEntry } from "./draft"
import type { DateSegmentType, SegmentFormat } from "./segments"

/** One digit 0–9 from a character in any accepted numbering system, else null. */
export function digitOf(char: string, f: SegmentFormat): number | null {
  if ([...char].length !== 1) return null
  const n = createNumberParser(f.options.locale, { useGrouping: false }).parse(char)
  return n !== null && Number.isInteger(n) && n >= 0 && n <= 9 ? n : null
}

/** A buffer of Latin digits shown in the field's numbering system. */
export const digitsText = (buffer: string, f: SegmentFormat) =>
  [...buffer].map((d) => f.number("year", Number(d))).join("")

/** The numbers a user types into a numeric segment (a 12-hour hour is typed 1–12). */
function typedRange(type: DateSegmentType, d: Draft, f: SegmentFormat) {
  if (type === "hour" && f.hour12) return { min: 1, max: 12 }
  return limits(type, d, f)
}

export type DigitPlan =
  /** Not a digit: the insertion is rejected before it changes the input. */
  | { readonly kind: "reject" }
  /** The buffer is full in the last segment (reka-ui#2002): nothing changes. */
  | { readonly kind: "ignore" }
  | {
      readonly kind: "accept"
      readonly entry: SegmentEntry
      readonly buffer: string
      /** No further digit fits: focus moves on (and the segment commits). */
      readonly advance: boolean
    }

const full = (buffer: string, max: number) =>
  buffer !== "" && (buffer.length >= String(max).length || Number(`${buffer}0`) > max)

/**
 * A digit typed into a numeric segment whose typed text so far is `buffer` (Latin digits;
 * "" right after focus, so the first digit replaces the shown value).
 */
export function planDigit(
  type: DateSegmentType,
  char: string,
  buffer: string,
  d: Draft,
  f: SegmentFormat,
): DigitPlan {
  const digit = digitOf(char, f)
  if (digit === null || type === "era" || type === "dayPeriod") return { kind: "reject" }
  const { min, max } = typedRange(type, d, f)
  if (full(buffer, max)) return { kind: "ignore" }
  // Over the limit: start again from this digit (React Aria's and the native control's rule).
  let next = `${buffer}${digit}`
  if (Number(next) > max) next = String(digit)
  const n = Number(next)
  const value = n < min ? null : type === "hour" && f.hour12 ? n % 12 : n
  return {
    kind: "accept",
    entry: { value, text: digitsText(next, f) },
    buffer: next,
    advance: full(next, max),
  }
}

/** Names without the prefix they all share (era names: "平成", "令和" keep all; "AD"/"BC" too). */
function stripCommonPrefix(names: readonly string[]): readonly string[] {
  if (names.length < 2) return names
  let i = 0
  const first = names[0] ?? ""
  while (i < first.length && names.every((n) => n[i] === first[i])) i++
  return names.map((n) => n.slice(i))
}

export type NamePlan =
  | { readonly kind: "reject" }
  /** A prefix of several names: kept in the buffer, nothing set yet. */
  | { readonly kind: "partial"; readonly buffer: string }
  | { readonly kind: "match"; readonly value: number }

/**
 * Typed text against a segment's names, compared with the locale's base-sensitivity
 * collation; the day period also takes Latin "a"/"p" in every locale (reka-ui#980).
 */
export function planName(type: "dayPeriod" | "era", typed: string, f: SegmentFormat): NamePlan {
  if (type === "dayPeriod" && /^[ap]$/i.test(typed)) {
    return { kind: "match", value: typed.toLowerCase() === "a" ? 0 : 1 }
  }
  const names = type === "dayPeriod" ? f.dayPeriods : stripCommonPrefix(f.eras.map((e) => e.name))
  const collator = new Intl.Collator(f.options.locale, { sensitivity: "base" })
  const hits = names
    .map((name, i) => ({ i, name }))
    .filter(({ name }) => collator.compare(name.slice(0, typed.length), typed) === 0)
  const only = hits.length === 1 ? hits[0] : undefined
  if (only) return { kind: "match", value: only.i }
  if (hits.length > 1) return { kind: "partial", buffer: typed }
  return { kind: "reject" }
}

/** "/", "-", ".", ":", a space, or a character of the locale's own literals (spec "Typing"). */
export function isSeparator(char: string, f: SegmentFormat): boolean {
  if ([...char].length !== 1 || digitOf(char, f) !== null) return false
  if ("/-.:, ".includes(char)) return true
  return f.segments.some(
    (s) => s.type === "literal" && s.text.replace(/[⁦-⁩‎‏]/g, "").trim().includes(char),
  )
}
