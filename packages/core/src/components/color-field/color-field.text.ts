// Color Field text rules (color-field "Text Filtering", "Value And Commit"), pure: what partial
// text is acceptable while typing, the lenient parse at a commit, alpha on a hex commit.

import { type Color, makeColor } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { tryParseColor } from "../shared/color/parse"

export type ColorFieldFormat = "hex" | "css"

/** Acceptable partial input: hex is an optional `#` and at most 6 (8 with alpha) hex digits. */
export function acceptColorText(text: string, format: ColorFieldFormat, alpha: boolean): boolean {
  if (format === "css") return true
  return (alpha ? /^#?[0-9a-f]{0,8}$/i : /^#?[0-9a-f]{0,6}$/i).test(text)
}

/**
 * The colour a committed text gives: `#` optional and any case for hex (3 or 6 digits, 4 or 8
 * with alpha), any `parseColor` string for css; `null` for empty text; `undefined` when it does
 * not parse.
 */
export function parseColorText(
  text: string,
  format: ColorFieldFormat,
  alpha: boolean,
): Color | null | undefined {
  const t = text.trim()
  if (t === "") return null
  if (format === "css") return tryParseColor(t) ?? undefined
  const digits = t.startsWith("#") ? t.slice(1) : t
  const lengths = alpha ? [3, 4, 6, 8] : [3, 6]
  if (!/^[0-9a-f]+$/i.test(digits) || !lengths.includes(digits.length)) return undefined
  return tryParseColor(`#${digits}`) ?? undefined
}

/**
 * The colour a parsed hex commit sets: a 3/6-digit hex keeps the current alpha (zag#884); with
 * `alpha` an 8/4-digit hex sets it; without `alpha` the alpha never changes.
 */
export function commitAlpha(
  parsed: Color,
  text: string,
  current: Color | null,
  alpha: boolean,
): Color {
  const digits = text.trim().replace(/^#/, "")
  const hasAlpha = digits.length === 4 || digits.length === 8
  if (alpha && hasAlpha) return parsed
  return makeColor(parsed.space, parsed.channels, current?.alpha ?? 1)
}

/** The text a committed colour shows. */
export function colorFieldText(color: Color | null, format: ColorFieldFormat, alpha: boolean) {
  if (!color) return ""
  if (format === "css") return formatColor(color, "css")
  return formatColor(alpha ? color : makeColor(color.space, color.channels, 1), "hex")
}
