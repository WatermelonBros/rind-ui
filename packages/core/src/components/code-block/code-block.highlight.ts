// Code Block's built-in highlighter (spec "Built-in Highlighting"): a state-stack lexer, pure
// TypeScript, no dependency (research: "Addendum: built-in highlighting"). One rule is tried at a
// time at the current index with a sticky regex; no match consumes one character as plain text,
// so every step consumes input and the scan is linear in the steps.

/** The fixed token set: each is a `data-token` value and a `--rind-code-token-*` colour. */
export const CODE_TOKEN_TYPES = [
  "keyword",
  "string",
  "comment",
  "number",
  "function",
  "type",
  "tag",
  "attr",
  "punctuation",
  "operator",
  "property",
  "variable",
  "regex",
] as const
export type CodeTokenType = (typeof CODE_TOKEN_TYPES)[number]

/** One piece of a line: `token` absent means plain text. */
export interface HighlightToken {
  readonly text: string
  readonly token?: CodeTokenType
}

/** The previous significant token (not whitespace, not a comment): what `when` decides on. */
export type HighlightPrev = HighlightToken | undefined

export interface CodeGrammarRule {
  /**
   * Tried at the current index only (made sticky; `g` is dropped). It must consume what it scans:
   * let an unterminated construct end at the line or input end (`(?:\*\/|$)`) instead of failing
   * after a long scan, and keep quantified alternatives disjoint (no `(a|a+)+`).
   */
  readonly match: RegExp
  /** The token type, or a function of the matched text (a keyword set); absent: plain. */
  readonly token?:
    | CodeTokenType
    | ((text: string, prev: HighlightPrev) => CodeTokenType | undefined)
  /** Only when this holds for the previous significant token (regex vs division, `<` vs a tag). */
  readonly when?: (prev: HighlightPrev) => boolean
  /** Enter a state on top of the current one. */
  readonly push?: string
  /** Replace the current state. */
  readonly next?: string
  /** Leave the current state (never the last one, so a stray `}` is harmless). */
  readonly pop?: true
}

/** A language: ordered rules per state; lexing starts in `root`. */
export interface CodeGrammar {
  readonly states: { readonly root: readonly CodeGrammarRule[] } & Readonly<
    Record<string, readonly CodeGrammarRule[]>
  >
}

const sticky = new WeakMap<RegExp, RegExp>()
function stickyOf(re: RegExp): RegExp {
  let s = sticky.get(re)
  if (!s) {
    s = new RegExp(re.source, `${re.flags.replace(/[gy]/g, "")}y`)
    sticky.set(re, s)
  }
  return s
}

/** The source's tokens, flat, in order; concatenated they are the source with `\n` newlines. */
export function tokenize(code: string, grammar: CodeGrammar): readonly HighlightToken[] {
  const src = code.replace(/\r\n?/g, "\n")
  const out: HighlightToken[] = []
  const stack: string[] = ["root"]
  let prev: HighlightPrev
  let plain = ""
  let i = 0
  const flush = () => {
    if (plain) out.push({ text: plain })
    plain = ""
  }
  while (i < src.length) {
    const rules = grammar.states[stack[stack.length - 1] ?? "root"] ?? grammar.states.root
    let rule: CodeGrammarRule | undefined
    let text = ""
    for (const r of rules) {
      if (r.when && !r.when(prev)) continue
      const re = stickyOf(r.match)
      re.lastIndex = i
      const m = re.exec(src)
      if (m && m[0].length > 0) {
        rule = r
        text = m[0]
        break
      }
    }
    if (!rule) {
      text = src[i] ?? ""
      plain += text
      if (text.trim()) prev = { text }
      i += 1
      continue
    }
    const token = typeof rule.token === "function" ? rule.token(text, prev) : rule.token
    if (token) {
      flush()
      out.push({ text, token })
    } else plain += text
    if (token !== "comment" && text.trim()) prev = token ? { text, token } : { text }
    if (rule.pop && stack.length > 1) stack.pop()
    if (rule.next) stack[stack.length - 1] = rule.next
    if (rule.push) stack.push(rule.push)
    i += text.length
  }
  flush()
  return out
}

/**
 * The tokens per source line, split the way `splitLines` splits the source: a token spanning
 * lines (a block comment, a template string) is cut at each newline and keeps its type.
 */
export function highlightCode(
  code: string,
  grammar: CodeGrammar,
): readonly (readonly HighlightToken[])[] {
  const lines: HighlightToken[][] = [[]]
  for (const t of tokenize(code, grammar)) {
    const parts = t.text.split("\n")
    parts.forEach((text, n) => {
      if (n > 0) lines.push([])
      if (text) lines[lines.length - 1]?.push(t.token ? { text, token: t.token } : { text })
    })
  }
  // As `splitLines`: one trailing newline adds no line, so the count matches the plain render.
  if (lines.length > 1 && lines[lines.length - 1]?.length === 0) lines.pop()
  return lines
}
