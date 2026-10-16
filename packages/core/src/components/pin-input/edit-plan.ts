// Every Pin Input editing rule as pure functions (design §1, §3): the one input's insertions
// are planned here before the browser applies them, so replacement, truncation and separators
// are deterministic; deletions and undo stay native.

export type PinValidationType = "numeric" | "alphanumeric" | "alpha"

export interface PinRules {
  readonly length: number
  readonly validationType?: PinValidationType | undefined
  /** One accepted character (replaces `validationType`). */
  readonly pattern?: RegExp | undefined
  /** Applied after NFKC (e.g. uppercasing). */
  readonly sanitize?: ((text: string) => string) | undefined
}

const TYPES: Readonly<Record<PinValidationType, RegExp>> = {
  numeric: /^[0-9]$/,
  alphanumeric: /^[A-Za-z0-9]$/,
  alpha: /^[A-Za-z]$/,
}

/** Whether one character is accepted. */
export function accepts(char: string, rules: PinRules): boolean {
  const re = rules.pattern ?? TYPES[rules.validationType ?? "numeric"]
  // A global or sticky pattern keeps lastIndex between calls: test a fresh copy.
  return new RegExp(re.source, re.flags.replace(/[gy]/g, "")).test(char)
}

/**
 * NFKC (full-width digits become ASCII: zag#1507), then the consumer's `sanitize`; pasted and
 * filled text also loses whitespace, `-` and `.` (input-otp#53).
 */
export function normalise(text: string, rules: PinRules, pasted = false): string {
  const nfkc = text.normalize("NFKC")
  const clean = rules.sanitize ? rules.sanitize(nfkc) : nfkc
  return pasted ? clean.replace(/[\s.-]/g, "") : clean
}

/** The first rejected character of `text`, or null when every one is accepted. */
export function rejected(text: string, rules: PinRules): string | null {
  for (const char of text) if (!accepts(char, rules)) return char
  return null
}

export type PinEditReason = "INPUT" | "PASTE"

/** An insertion the component applies itself: the next value and its collapsed caret. */
export interface PinEdit {
  readonly next: string
  readonly caret: number
  readonly reason: PinEditReason
}

export type PinEditPlan =
  /** Refused before it is applied: nothing changes (`onValueInvalid(text)`). */
  | { readonly accept: false; readonly text: string }
  /** Deletions, cuts, undo, redo: the native edit proceeds and its `input` event follows. */
  | { readonly accept: true; readonly edit: null }
  | { readonly accept: true; readonly edit: PinEdit }

export interface PinEditInput {
  /** `InputEvent.inputType`. */
  readonly inputType: string
  readonly data: string | null
}

const PASTED = new Set([
  "insertFromPaste",
  "insertFromDrop",
  "insertFromYank",
  "insertReplacementText",
])

/**
 * Plans one `beforeinput`. `selection` is the input's selection when it happened (a
 * collapsed caret is `[i, i]`).
 */
export function planEdit(
  value: string,
  selection: readonly [number, number],
  input: PinEditInput,
  rules: PinRules,
): PinEditPlan {
  const { inputType } = input
  // Deletions and history stay native; so do line breaks (Enter: implicit form submission).
  if (
    !inputType.startsWith("insert") ||
    inputType === "insertLineBreak" ||
    inputType === "insertParagraph"
  ) {
    return { accept: true, edit: null }
  }
  const pasted = PASTED.has(inputType)
  const text = normalise(input.data ?? "", rules, pasted)
  if (text === "")
    return { accept: true, edit: { next: value, caret: selection[0], reason: "INPUT" } }
  if (rejected(text, rules) !== null) return { accept: false, text: input.data ?? "" }
  const { length } = rules
  const start = Math.min(selection[0], value.length)
  const end = Math.min(Math.max(selection[1], start), value.length)
  if (pasted) {
    // A full code replaces whatever is there (zag#470); a shorter one goes in at the caret.
    if (text.length >= length) {
      return { accept: true, edit: { next: text.slice(0, length), caret: length, reason: "PASTE" } }
    }
    const next = (value.slice(0, start) + text + value.slice(end)).slice(0, length)
    return {
      accept: true,
      edit: { next, caret: Math.min(start + text.length, next.length), reason: "PASTE" },
    }
  }
  // Typing: a selection is replaced; then each character overwrites the slot at the caret
  // (the same character only advances: zag#3020) or appends while there is room.
  let next = value.slice(0, start) + value.slice(end)
  let caret = start
  for (const char of text) {
    if (caret < next.length) {
      if (end === start && next[caret] === char) {
        caret += 1
        continue
      }
      next =
        end === start
          ? next.slice(0, caret) + char + next.slice(caret + 1)
          : next.slice(0, caret) + char + next.slice(caret)
    } else if (next.length < length) {
      next += char
    } else {
      break
    }
    caret += 1
  }
  next = next.slice(0, length)
  return { accept: true, edit: { next, caret: Math.min(caret, next.length), reason: "INPUT" } }
}

/**
 * Applies a value the browser wrote itself (autofill, a script fill, a native deletion): the
 * same normalisation as a paste, then truncated. Null when a character is rejected.
 */
export function normaliseWrite(text: string, rules: PinRules): string | null {
  const clean = normalise(text, rules, true)
  return rejected(clean, rules) === null ? clean.slice(0, rules.length) : null
}
