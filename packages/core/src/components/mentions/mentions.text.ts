// Mentions' value model (add-mentions design §3–§5): plain text plus a parallel list of ranges.
// Everything here is pure: trigger detection at the caret, range reconciliation from a before /
// after diff (so it holds for typing, paste, cut, drag, Android and IME alike), and insertion.

export interface MentionTrigger {
  /** The character that opens the list ("@", "#", "/"). */
  readonly char: string
  /** The trigger's id (defaults to the char). */
  readonly id?: string | undefined
  /** "insert" puts the chosen label in the text; "action" removes the query and calls onSelect. */
  readonly behavior?: "insert" | "action" | undefined
  /** Only at the start of the text or of a line (default for "/"). */
  readonly startOfInput?: boolean | undefined
  readonly allowSpaces?: boolean | undefined
  /** Longer queries close the list (default 50). */
  readonly maxQueryLength?: number | undefined
  /** Append a space after an inserted label (default true). */
  readonly appendSpace?: boolean | undefined
}

/** A mention in the text: `[start, end)` is its label, `trigger` the trigger's id. */
export interface MentionRange {
  readonly id: string
  readonly trigger: string
  readonly start: number
  readonly end: number
}

/** The trigger match the caret is in: `[start, end)` covers the trigger char and the query. */
export interface TriggerMatch {
  readonly trigger: string
  readonly start: number
  readonly end: number
  readonly query: string
}

export const triggerId = (t: MentionTrigger) => t.id ?? t.char

const isSpace = (c: string | undefined) => c !== undefined && /\s/u.test(c)

/**
 * The trigger match ending at the caret, or null. The trigger char starts the text or follows
 * whitespace; the query has no whitespace (unless `allowSpaces`) and no other trigger char; the
 * caret is inside no existing mention; a dismissed match (Escape) at the same start stays closed.
 */
export function matchTrigger(
  value: string,
  caret: number,
  triggers: readonly MentionTrigger[],
  options: {
    readonly mentions?: readonly MentionRange[] | undefined
    readonly dismissedAt?: number | null | undefined
  } = {},
): TriggerMatch | null {
  if (caret < 1 || caret > value.length) return null
  if (options.mentions?.some((m) => caret > m.start && caret <= m.end)) return null
  for (let i = caret - 1; i >= 0; i--) {
    const c = value[i] as string
    const t = triggers.find((tr) => tr.char === c)
    if (t) {
      const before = value[i - 1]
      const startOk =
        (t.startOfInput ?? t.char === "/") ? i === 0 || before === "\n" : i === 0 || isSpace(before)
      const query = value.slice(i + 1, caret)
      if (!startOk) return null
      if (query.length > (t.maxQueryLength ?? 50)) return null
      if (options.dismissedAt === i) return null
      if (options.mentions?.some((m) => i >= m.start && i < m.end)) return null
      return { trigger: triggerId(t), start: i, end: caret, query }
    }
    if (c === "\n") return null
    if (isSpace(c) && !triggers.some((tr) => tr.allowSpaces)) return null
  }
  return null
}

/**
 * The edit between two texts: `[start, oldEnd)` became `[start, newEnd)`. A repeated character
 * makes the diff ambiguous ("@Ada @Bo" to "@Bo"); the caret after the edit, when known, is where
 * the edit ends.
 */
export function diffText(before: string, after: string, caretAfter?: number) {
  let suffix = 0
  const maxSuffix = Math.min(before.length, after.length)
  while (
    suffix < maxSuffix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++
  }
  if (caretAfter !== undefined && caretAfter >= 0 && caretAfter <= after.length) {
    suffix = Math.min(suffix, after.length - caretAfter)
  }
  const newEnd = after.length - suffix
  const oldEnd = before.length - suffix
  let start = 0
  const maxStart = Math.min(newEnd, oldEnd)
  while (start < maxStart && before[start] === after[start]) start++
  return { start, oldEnd, newEnd }
}

/**
 * The text and ranges after an edit (design §4), from the texts before and after it:
 * - an edit before a range shifts it, one after it leaves it;
 * - a deletion that took a range's first or last character (Delete, Backspace) or all of it
 *   removes the whole mention: what is left of its label goes too, with the space after it;
 * - any other edit inside a range dissolves it into plain text (the text stays).
 * Typing at either edge is plain text outside the range.
 */
export function applyEdit(
  before: string,
  after: string,
  ranges: readonly MentionRange[],
  /** The caret after the edit: disambiguates a repeated character. */
  caretAfter?: number,
): {
  readonly value: string
  readonly ranges: readonly MentionRange[]
  /** Where the caret goes when a mention was removed; null when the text is the user's. */
  readonly caret: number | null
} {
  const { start, oldEnd, newEnd } = diffText(before, after, caretAfter)
  const delta = newEnd - oldEnd
  let kept: MentionRange[] = []
  /** Spans of `after` to remove (the remnants of removed mentions). */
  const remnants: { start: number; end: number }[] = []
  for (const r of ranges) {
    if (oldEnd <= r.start) kept.push({ ...r, start: r.start + delta, end: r.end + delta })
    else if (start >= r.end) kept.push(r)
    else if (newEnd === start && (start <= r.start || oldEnd >= r.end)) {
      const remStart = Math.min(r.start, start)
      const remEnd = r.end > oldEnd ? r.end + delta : start
      remnants.push({ start: remStart, end: remEnd })
    }
    // Otherwise dissolved: an edit inside the label keeps its text, as plain text.
  }
  if (remnants.length === 0) return { value: after, ranges: kept, caret: null }
  let value = after
  let caret = 0
  for (const span of remnants.sort((x, y) => y.start - x.start)) {
    // The space an inserted label was followed by goes with it.
    const end =
      value[span.end] === " " && (span.start === 0 || isSpace(value[span.start - 1]))
        ? span.end + 1
        : span.end
    value = value.slice(0, span.start) + value.slice(end)
    const removed = end - span.start
    kept = kept.map((k) =>
      k.start >= end ? { ...k, start: k.start - removed, end: k.end - removed } : k,
    )
    caret = span.start
  }
  return { value, ranges: kept, caret }
}

/** Replaces a trigger match with a mention label (and a space): the new text, ranges and caret. */
export function insertMention(
  value: string,
  match: TriggerMatch,
  ranges: readonly MentionRange[],
  mention: {
    readonly id: string
    readonly label: string
    readonly appendSpace?: boolean | undefined
  },
): { readonly value: string; readonly ranges: readonly MentionRange[]; readonly caret: number } {
  const space = mention.appendSpace !== false && value[match.end] !== " " ? " " : ""
  const text = mention.label + space
  const next = value.slice(0, match.start) + text + value.slice(match.end)
  const delta = text.length - (match.end - match.start)
  const shifted = ranges.map((r) =>
    r.start >= match.end ? { ...r, start: r.start + delta, end: r.end + delta } : r,
  )
  const added: MentionRange = {
    id: mention.id,
    trigger: match.trigger,
    start: match.start,
    end: match.start + mention.label.length,
  }
  return {
    value: next,
    ranges: [...shifted, added].sort((a, b) => a.start - b.start),
    caret: match.start + text.length + (space ? 0 : value[match.end] === " " ? 1 : 0),
  }
}

/** Removes the trigger and its query ("action" triggers): the new text and caret. */
export function removeMatch(value: string, match: TriggerMatch, ranges: readonly MentionRange[]) {
  const len = match.end - match.start
  return {
    value: value.slice(0, match.start) + value.slice(match.end),
    ranges: ranges.map((r) =>
      r.start >= match.end ? { ...r, start: r.start - len, end: r.end - len } : r,
    ),
    caret: match.start,
  }
}

/** Ranges that still read their label in the text (a parent's value may have moved on). */
export function validRanges(value: string, ranges: readonly MentionRange[]) {
  return ranges.filter((r) => r.start >= 0 && r.end <= value.length && r.start < r.end)
}
