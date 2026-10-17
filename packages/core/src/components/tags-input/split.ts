// Delimiter splitting (tags-input "Delimiters", "Paste"): strings match literally (never
// `new RegExp(string)`: "|", "+", "." stay themselves), RegExps as given; a zero-length
// match is ignored.

export type Delimiter = string | RegExp
export type Delimiters = Delimiter | readonly Delimiter[]

const list = (d: Delimiters): readonly Delimiter[] =>
  typeof d === "string" || d instanceof RegExp ? [d] : d

/** The first delimiter match at or after `from`: its index and length. */
function nextMatch(text: string, from: number, delimiters: readonly Delimiter[]) {
  let best: { index: number; length: number } | null = null
  for (const d of delimiters) {
    if (typeof d === "string") {
      if (d === "") continue
      const i = text.indexOf(d, from)
      if (i >= 0 && (best === null || i < best.index)) best = { index: i, length: d.length }
    } else {
      // A non-global clone: `lastIndex` state never leaks between calls.
      const re = new RegExp(d.source, d.flags.replace(/[gy]/g, ""))
      const m = re.exec(text.slice(from))
      if (m && m[0].length > 0) {
        const i = from + m.index
        if (best === null || i < best.index) best = { index: i, length: m[0].length }
      }
    }
  }
  return best
}

/** Splits at every delimiter: the complete segments, and the text after the last delimiter. */
export function splitDelimited(
  text: string,
  delimiters: Delimiters,
): { readonly complete: readonly string[]; readonly rest: string } {
  const ds = list(delimiters)
  const complete: string[] = []
  let from = 0
  for (;;) {
    const m = nextMatch(text, from, ds)
    if (!m) break
    complete.push(text.slice(from, m.index))
    from = m.index + m.length
  }
  return { complete, rest: text.slice(from) }
}

/** Whether `text` holds a delimiter. */
export const hasDelimiter = (text: string, delimiters: Delimiters) =>
  nextMatch(text, 0, list(delimiters)) !== null

/** The paste delimiters by default: the delimiters plus newline, tab and ";". */
export const defaultPasteDelimiters = (delimiters: Delimiters): readonly Delimiter[] => [
  ...list(delimiters),
  "\n",
  "\r",
  "\t",
  ";",
]

/** The first string delimiter (refused paste segments are joined back with it). */
export const joiner = (delimiters: Delimiters) =>
  list(delimiters).find((d): d is string => typeof d === "string") ?? " "
