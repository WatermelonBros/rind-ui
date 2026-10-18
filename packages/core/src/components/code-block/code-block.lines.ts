// Code Block's line model (spec "Line Model"): no DOM, so the server and the client split the
// same way and hydration matches.

/** Normalises CRLF and CR, drops one trailing newline; an empty source is one empty line. */
export function splitLines(code: string): readonly string[] {
  const lines = code.replace(/\r\n?/g, "\n").split("\n")
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
  return lines
}

/** 1-based line numbers and inclusive ranges: `[3, [5, 7]]`. */
export type LineRanges = readonly (number | readonly [number, number])[]

/** The set of 1-based line numbers `ranges` names (a reversed range is read low to high). */
export function parseRanges(ranges: LineRanges | undefined): ReadonlySet<number> {
  const out = new Set<number>()
  for (const r of ranges ?? []) {
    if (typeof r === "number") {
      if (Number.isInteger(r)) out.add(r)
      continue
    }
    const lo = Math.min(r[0], r[1])
    const hi = Math.max(r[0], r[1])
    for (let n = lo; n <= hi; n++) out.add(n)
  }
  return out
}

/** Consecutive runs of the sorted numbers: `{3, 5, 6, 7}` → `[[3, 3], [5, 7]]`. */
export function lineRuns(lines: ReadonlySet<number>): readonly (readonly [number, number])[] {
  const sorted = [...lines].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (const n of sorted) {
    const last = runs[runs.length - 1]
    if (last && n === last[1] + 1) last[1] = n
    else runs.push([n, n])
  }
  return runs
}

declare const trusted: unique symbol

/**
 * Highlighter output, one HTML string per source line. Made only by `trustedCodeHtml`, so a raw
 * string cannot reach the HTML sink by accident. A brand, not a sanitizer: pass only what a
 * highlighter produced (it escapes the source), never user input.
 */
export interface TrustedCodeHtml {
  readonly [trusted]: true
  readonly lines: readonly string[]
}

/**
 * Splits well-formed highlighter HTML into lines whose tags are balanced: an element spanning
 * lines (a multi-line string or comment) is closed at each line end and reopened on the next,
 * so every line parses on its own (an unclosed tag in server HTML would swallow the next lines).
 */
export function splitHtmlLines(html: string): readonly string[] {
  const open: { name: string; tag: string }[] = []
  return splitLines(html).map((line) => {
    const prefix = open.map((o) => o.tag).join("")
    for (const m of line.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
      if (m[3] === "/") continue
      if (m[1] === "/") {
        const at = open.map((o) => o.name).lastIndexOf(m[2] ?? "")
        if (at >= 0) open.splice(at, 1)
      } else open.push({ name: m[2] ?? "", tag: m[0] })
    }
    const suffix = [...open]
      .reverse()
      .map((o) => `</${o.name}>`)
      .join("")
    return prefix + line + suffix
  })
}

/**
 * Marks highlighter output as HTML to inject: one string per line, or one string split on
 * newlines with tags that span lines closed and reopened per line.
 */
export function trustedCodeHtml(html: string | readonly string[]): TrustedCodeHtml {
  const lines = typeof html === "string" ? splitHtmlLines(html) : [...html]
  // Sound: the brand is a type-only marker; this function is its one constructor.
  return Object.freeze({ lines }) as unknown as TrustedCodeHtml
}
