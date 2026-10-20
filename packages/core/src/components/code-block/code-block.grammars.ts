// The built-in grammars (spec "Built-in Highlighting"). Every pattern is tried at one index and
// either consumes what it scans or fails within a bounded look: unterminated strings end at the
// line end, unterminated comments at the input end, and quantified alternatives start with
// disjoint characters, so no input backtracks catastrophically.

import {
  type CodeGrammar,
  type CodeGrammarRule,
  type HighlightPrev,
  type HighlightToken,
  highlightCode,
} from "./code-block.highlight"

const ws: CodeGrammarRule = { match: /\s+/ }
const blockComment: CodeGrammarRule = { match: /\/\*[\s\S]*?(?:\*\/|$)/, token: "comment" }
const lineComment: CodeGrammarRule = { match: /\/\/[^\n]*/, token: "comment" }
const dq: CodeGrammarRule = { match: /"[^"\\\n]*(?:\\[\s\S][^"\\\n]*)*"?/, token: "string" }
const sq: CodeGrammarRule = { match: /'[^'\\\n]*(?:\\[\s\S][^'\\\n]*)*'?/, token: "string" }

const words = (s: string): ReadonlySet<string> => new Set(s.split(" "))

const JS_KEYWORDS = words(
  "as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield",
)
const TS_KEYWORDS = words(
  "abstract asserts declare enum implements infer interface is keyof module namespace override private protected public readonly satisfies type unique",
)
const TS_TYPES = words("any bigint boolean never number object string symbol unknown void")
const OPERAND_KEYWORDS = words("this super true false null undefined")

/**
 * After an operand, `/` divides and `<` compares; elsewhere they start a regex or a JSX tag.
 * `++`/`--` count as postfix (`x++ / 2`): a prefix one before a regex literal is not real code.
 */
function afterOperand(prev: HighlightPrev): boolean {
  if (!prev) return false
  if (prev.token === "keyword") return OPERAND_KEYWORDS.has(prev.text)
  if (prev.token === "punctuation" || prev.token === "operator")
    return /^(?:[)\]}]|\+\+|--)$/.test(prev.text)
  return true
}

/* @__NO_SIDE_EFFECTS__ */
function jsGrammar(o: { readonly ts: boolean; readonly jsx: boolean }): CodeGrammar {
  const kind = (text: string, prev: HighlightPrev, called: boolean) => {
    if (prev?.text === "." || prev?.text === "?.") return called ? "function" : "property"
    if (JS_KEYWORDS.has(text) || (o.ts && TS_KEYWORDS.has(text))) return "keyword"
    if (o.ts && TS_TYPES.has(text)) return "type"
    if (called) return "function"
    return /^[A-Z]/.test(text) ? "type" : undefined
  }
  const code: CodeGrammarRule[] = [
    ws,
    lineComment,
    blockComment,
    { match: /`/, token: "string", push: "template" },
    dq,
    sq,
    {
      match: /\/(?![*/])(?:[^\\/\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\]?)*\/?[a-z]*/,
      token: "regex",
      when: (p) => !afterOperand(p),
    },
    ...(o.jsx ? jsxStart : []),
    {
      match: /[\p{L}_$][\p{L}\p{N}_$]*(?=\s*(?:<[^<>\n]*>\s*)?\()/u,
      token: (t, p) => kind(t, p, true),
    },
    { match: /[\p{L}_$][\p{L}\p{N}_$]*/u, token: (t, p) => kind(t, p, false) },
    {
      match: /0[xXbBoO][\da-fA-F_]+n?|\.?\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d+)?n?/,
      token: "number",
    },
    { match: /\{/, token: "punctuation", push: "code" },
    { match: /\}/, token: "punctuation", pop: true },
    { match: /\?\.|\.\.\.|[()[\];,.]/, token: "punctuation" },
    // Alone, so a JSX tag right after them is not swallowed: `i=><li>`, `a&&<b/>`.
    { match: /=>|&&=?|\|\|=?|\?\?=?|\+\+|--/, token: "operator" },
    // A run never takes a `<` that may open a tag (`?<A/>`): that `<` is lexed on its own.
    { match: /(?:[-+*%=&|^!>?~:]|<(?![\p{L}_$>]))+|[</]/u, token: "operator" },
  ]
  return {
    states: {
      root: code,
      code,
      template: [
        { match: /`/, token: "string", pop: true },
        { match: /\$\{/, token: "punctuation", push: "code" },
        { match: /(?:[^`\\$]|\\[\s\S]|\$(?!\{))+/, token: "string" },
      ],
      ...(o.jsx ? jsxStates : {}),
    },
  }
}

/** In code, where an operand is expected: `<>` or `<Name` opens JSX (else `<` compares). */
const jsxStart: readonly CodeGrammarRule[] = [
  { match: /<>/, token: "punctuation", push: "jsxChildren", when: (p) => !afterOperand(p) },
  {
    // Not a generic arrow's type parameters: `<T,>(x) =>`, `<T extends U>(x) =>`.
    match: /<(?=[\p{L}_$])(?![\p{L}_$][\p{L}\p{N}_$]*\s*(?:,|extends\s))/u,
    token: "punctuation",
    push: "jsxTagName",
    when: (p) => !afterOperand(p),
  },
]
const jsxOpen: CodeGrammarRule = {
  match: /<(?=[\p{L}_$])/u,
  token: "punctuation",
  push: "jsxTagName",
}
const jsxStates: Readonly<Record<string, readonly CodeGrammarRule[]>> = {
  jsxTagName: [{ match: /[\p{L}_$][\p{L}\p{N}_$.:-]*/u, token: "tag", next: "jsxTag" }],
  jsxTag: [
    ws,
    { match: /\/>/, token: "punctuation", pop: true },
    { match: />/, token: "punctuation", next: "jsxChildren" },
    { match: /\{/, token: "punctuation", push: "code" },
    { match: /[\p{L}_$][\p{L}\p{N}_$:-]*/u, token: "attr" },
    { match: /=/, token: "operator" },
    { match: /"[^"]*"?|'[^']*'?/, token: "string" },
  ],
  jsxChildren: [
    { match: /<\//, token: "punctuation", next: "jsxClose" },
    { match: /<>/, token: "punctuation", push: "jsxChildren" },
    jsxOpen,
    { match: /\{/, token: "punctuation", push: "code" },
    { match: /[^<{]+/ },
  ],
  jsxClose: [
    ws,
    { match: /[\p{L}_$][\p{L}\p{N}_$.:-]*/u, token: "tag" },
    { match: />/, token: "punctuation", pop: true },
  ],
}

const css: CodeGrammar = {
  states: {
    root: [
      ws,
      blockComment,
      dq,
      sq,
      { match: /@[\w-]+/, token: "keyword" },
      { match: /\{/, token: "punctuation", push: "block" },
      { match: /\}/, token: "punctuation", pop: true },
      // A letter after the colon: `(min-width:600px)` is a feature and a value, not a pseudo.
      { match: /::?-?[a-zA-Z][\w-]*/, token: "keyword" },
      { match: /[.#][\w-]+/, token: "attr" },
      { match: /--[\w-]+/, token: "variable" },
      { match: /[a-zA-Z][\w-]*(?=\()/, token: "function" },
      { match: /[a-zA-Z][\w-]*/, token: "tag" },
      { match: /\d+(?:\.\d+)?(?:%|[a-zA-Z]+)?/, token: "number" },
      { match: /[[\](),:;=]/, token: "punctuation" },
      { match: /[>+~*&|^$]/, token: "operator" },
    ],
    block: [
      ws,
      blockComment,
      dq,
      sq,
      { match: /@[\w-]+/, token: "keyword" },
      { match: /\{/, token: "punctuation", push: "block" },
      { match: /\}/, token: "punctuation", pop: true },
      { match: /--[\w-]+/, token: "variable" },
      { match: /-?[a-zA-Z][\w-]*(?=\s*:)/, token: "property" },
      { match: /!important\b/, token: "keyword" },
      { match: /#[\da-fA-F]{3,8}\b/, token: "number" },
      { match: /[a-zA-Z-][\w-]*(?=\()/, token: "function" },
      { match: /-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?/, token: "number" },
      { match: /[.#][a-zA-Z_-][\w-]*/, token: "attr" },
      { match: /[a-zA-Z-][\w-]*/ },
      { match: /[(),:;]/, token: "punctuation" },
      { match: /[+*/>~&]/, token: "operator" },
    ],
  },
}

const html: CodeGrammar = {
  states: {
    root: [
      { match: /<!--[\s\S]*?(?:-->|$)/, token: "comment" },
      { match: /<![^>]*>?/, token: "keyword" },
      { match: /<\//, token: "punctuation", push: "close" },
      { match: /<(?=[a-zA-Z])/, token: "punctuation", push: "name" },
      { match: /&[#\w]+;/, token: "keyword" },
      { match: /[^<&]+/ },
    ],
    name: [{ match: /[a-zA-Z][\w:-]*/, token: "tag", next: "tag" }],
    tag: [
      ws,
      { match: /\/?>/, token: "punctuation", pop: true },
      { match: /=/, token: "operator" },
      { match: /"[^"]*"?|'[^']*'?/, token: "string" },
      { match: /[^\s"'>/=]+/, token: "attr" },
    ],
    close: [
      ws,
      { match: /[a-zA-Z][\w:-]*/, token: "tag" },
      { match: />/, token: "punctuation", pop: true },
    ],
  },
}

const json: CodeGrammar = {
  states: {
    root: [
      ws,
      lineComment,
      blockComment,
      { match: /"[^"\\\n]*(?:\\.[^"\\\n]*)*"(?=\s*:)/, token: "property" },
      dq,
      { match: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: "number" },
      { match: /true|false|null/, token: "keyword" },
      { match: /[{}[\]:,]/, token: "punctuation" },
    ],
  },
}

const BASH_KEYWORDS = words(
  "alias case declare do done elif else esac exit export fi for function if in local readonly return select shift source then unset until while",
)
const bashVar: CodeGrammarRule = {
  match: /\$\{[^}\n]*\}?|\$\([^)\n]*\)?|\$(?:\w+|[@#?$!*-])/,
  token: "variable",
}
const bash: CodeGrammar = {
  states: {
    root: [
      ws,
      bashVar,
      // Only at the start of a word: `a#b` and `$#` are not comments.
      { match: /(?<![^\s;|&()])#[^\n]*/, token: "comment" },
      { match: /'[^']*'?/, token: "string" },
      { match: /"/, token: "string", push: "dq" },
      { match: /--?[a-zA-Z][\w-]*/, token: "attr" },
      { match: /[a-zA-Z_][\w-]*/, token: (t) => (BASH_KEYWORDS.has(t) ? "keyword" : undefined) },
      { match: /\d+(?!\w)/, token: "number" },
      { match: /[|&;<>=]+/, token: "operator" },
      { match: /[(){}[\]]/, token: "punctuation" },
    ],
    dq: [
      { match: /"/, token: "string", pop: true },
      bashVar,
      { match: /(?:[^"\\$]|\\[\s\S])+/, token: "string" },
      { match: /\$/, token: "string" },
    ],
  },
}

const ts = jsGrammar({ ts: true, jsx: false })
const tsx = jsGrammar({ ts: true, jsx: true })
const js = jsGrammar({ ts: false, jsx: false })
const jsx = jsGrammar({ ts: false, jsx: true })

/** The built-in languages and their aliases. */
export const codeGrammars = {
  ts,
  typescript: ts,
  mts: ts,
  cts: ts,
  tsx,
  js,
  javascript: js,
  mjs: js,
  cjs: js,
  jsx,
  css,
  html,
  json,
  jsonc: json,
  bash,
  sh: bash,
  shell: bash,
  zsh: bash,
} as const satisfies Record<string, CodeGrammar>

export type CodeLanguage = keyof typeof codeGrammars

/**
 * The tokens per line a block renders: the consumer's `lines`; none for `html` (it renders its
 * own markup); else the built-in highlighting of `language`; none for an unknown language.
 */
export function codeBlockTokens<T extends HighlightToken>(input: {
  readonly code: string
  readonly language?: string | CodeGrammar | undefined
  readonly lines?: readonly (readonly T[])[] | undefined
  readonly html?: unknown
}): readonly (readonly (T | HighlightToken)[])[] | undefined {
  if (input.lines || input.html !== undefined) return input.lines
  const grammar = resolveGrammar(input.language)
  return grammar ? highlightCode(input.code, grammar) : undefined
}

/** A grammar, a built-in name (any case), or `undefined` for an unknown name: rendered plain. */
export function resolveGrammar(
  language: string | CodeGrammar | undefined,
): CodeGrammar | undefined {
  if (language === undefined || typeof language !== "string") return language
  const key = language.toLowerCase()
  // Sound: `key` is an own key of `codeGrammars`, checked just before.
  return Object.hasOwn(codeGrammars, key) ? codeGrammars[key as CodeLanguage] : undefined
}
