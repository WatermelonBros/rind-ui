// Code Block's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in code-block.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"code-block"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const flags = {
  "data-wrapped": "While lines wrap.",
  "data-expanded": "While every line shows (always, unless collapsed).",
  "data-collapsible": "The block is longer than `maxLines`.",
  "data-scrollable": "The content overflows its scroll container (measured on the client).",
}

const focus = { "data-focus": "Focused.", "data-focus-visible": "Keyboard focus." }

export const codeBlockMeta = {
  scope: "code-block",
  name: "CodeBlock",
  stateless: false,
  parts: [
    {
      name: "CodeBlock.Root",
      part: "root",
      element: "div",
      description: "Holds the source and the state.",
    },
    {
      name: "CodeBlock.Header",
      part: "header",
      element: "div",
      description: "Holds the Title and the triggers.",
    },
    {
      name: "CodeBlock.Title",
      part: "title",
      element: "span",
      description: "Names the scrollable content (`aria-labelledby`).",
    },
    {
      name: "CodeBlock.CopyTrigger",
      part: "copy-trigger",
      element: "button",
      description:
        'Copies `code` through the clipboard; named by its content, else "Copy code". The name never changes; the result is announced.',
    },
    {
      name: "CodeBlock.WrapTrigger",
      part: "wrap-trigger",
      element: "button",
      description: 'A toggle button (`aria-pressed`) for soft wrap; else named "Wrap lines".',
    },
    {
      name: "CodeBlock.CollapseTrigger",
      part: "collapse-trigger",
      element: "button",
      description:
        'A disclosure button (`aria-expanded`, `aria-controls`) for blocks longer than `maxLines`; hidden otherwise. Else named "Show all lines".',
    },
    {
      name: "CodeBlock.Content",
      part: "content",
      element: "pre",
      description:
        'The scroll container (`dir="ltr"`). A named tab stop (`role="group"`) only while it overflows. Renders the `code` element and one Line per source line, or `children(line)` per line.',
    },
    {
      name: "(inside Content)",
      part: "code",
      element: "code",
      description: "Sets the line-number counter start.",
    },
    {
      name: "CodeBlock.Line",
      part: "line",
      element: "span",
      description: "One source line: tokens as text, or the line's trusted HTML.",
    },
    {
      name: "(inside Content)",
      part: "description",
      element: "span",
      description: 'Visually hidden "Highlighted lines: …", the Content\'s description.',
    },
  ],
  props: {
    code: {
      type: "string",
      description:
        "Required. The source: rendered when no highlight is given, and what Copy writes.",
    },
    lines: {
      type: "readonly (readonly CodeToken[])[]",
      description:
        "Highlighted tokens, one list per line (`{ text, className?, style? }`), rendered as text.",
    },
    html: {
      type: "TrustedCodeHtml",
      description:
        "Highlighter output from `trustedCodeHtml(html)`, injected per line. Never user input.",
    },
    lineNumbers: {
      type: "boolean",
      default: "false",
      description: "Draws line numbers with a CSS counter (never in the text).",
    },
    startLineNumber: {
      type: "number",
      default: "1",
      description:
        "The first line's number (`data-line`, `highlightLines` and the counter follow it).",
    },
    highlightLines: {
      type: "LineRanges",
      description: "Line numbers and inclusive ranges: `[3, [5, 7]]`.",
    },
    maxLines: { type: "number", description: "Longer blocks start collapsed to this many lines." },
    wrapped: { type: "boolean", description: "Controlled soft wrap." },
    defaultWrapped: {
      type: "boolean",
      default: "false",
      description: "Uncontrolled initial wrap.",
    },
    onWrappedChange: {
      type: "(wrapped, details) => void",
      description: "WrapTrigger proposes the opposite value; `cancel()` vetoes it.",
    },
    expanded: { type: "boolean", description: "Controlled expansion (with `maxLines`)." },
    defaultExpanded: {
      type: "boolean",
      description:
        "Uncontrolled initial expansion; default: collapsed when longer than `maxLines`.",
    },
    onExpandedChange: {
      type: "(expanded, details) => void",
      description: "CollapseTrigger proposes the opposite value.",
    },
    copyFeedbackDuration: {
      type: "number",
      default: "2000",
      description: "How long `copied` / `error` last (ms).",
    },
    onCopy: {
      type: "({ ok, error? }) => void",
      description: "The copy's result, after the write settled.",
    },
    messages: {
      type: "Partial<CodeBlockMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-copy-state": '"idle", "copying", "copied" or "error".',
      ...flags,
    },
    header: base("header"),
    title: base("title"),
    "copy-trigger": { ...base("copy-trigger"), ...focus, "data-state": "The copy state." },
    "wrap-trigger": { ...base("wrap-trigger"), ...focus, "data-state": '"on" or "off".' },
    "collapse-trigger": {
      ...base("collapse-trigger"),
      ...focus,
      "data-state": '"open" or "closed".',
    },
    content: { ...base("content"), ...flags, "data-line-numbers": "With `lineNumbers`." },
    code: base("code"),
    line: {
      ...base("line"),
      "data-line": "The line's number.",
      "data-highlighted": "Listed in `highlightLines`.",
    },
    description: base("description"),
  },
  keyboard: [
    ["Tab", "Reaches the content only while it scrolls; the arrow keys then scroll it."],
    ["Enter, Space", "On a trigger: copies, toggles wrap, or expands."],
  ],
  states: {
    idle: "No copy in progress.",
    copying: "The clipboard write has not settled.",
    copied:
      'The write succeeded; "Copied" was announced. Back to idle after `copyFeedbackDuration`.',
    error:
      'The write failed; "Copy failed" was announced. Back to idle after `copyFeedbackDuration`.',
  },
  contract: {
    actions: {
      copy: ["pointer", "keyboard", "touch", "virtual"],
      settleCopy: ["pointer", "keyboard", "touch", "virtual"],
      setWrapped: ["pointer", "keyboard", "virtual"],
      setExpanded: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "text",
      "lineCount",
      "highlightedLines",
      "isWrapped",
      "isExpanded",
      "isScrollable",
      "copyState",
    ],
    traits: [],
  },
} as const satisfies ComponentMeta
