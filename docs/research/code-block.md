# Code Block — research

Status: done · Wave: 2

A block of source code to read and copy: a header with a title (file name, language), a copy
button, optional line numbers, highlighted lines, a soft-wrap toggle, a collapsed preview for
long blocks, and tabs when one example spans several files. The brief (user, via the
coordinator, 2026-10-18) fixes three constraints: **highlighter-agnostic** (the consumer passes
tokens or pre-highlighted HTML; the site and reado-web use highlight.js, Reado uses
CodeMirror/lezer; an adapter example, no highlighter dependency), **readable as server HTML with
no client JavaScript**, and **used everywhere the site shows code** (example frames, Markdown
fences).

Sources: shallow clones read 2026-10-18 — Chakra UI v3
`packages/react/src/components/code-block/*` and `clipboard/`; Zag
`packages/machines/clipboard/src/*` (Ark's Clipboard); Mantine
`packages/@mantine/code-highlight/src/*` (CodeHighlight, CodeHighlightTabs); Expressive Code
`plugin-frames` (copy), `plugin-line-numbers`, `plugin-text-markers`,
`plugin-collapsible-sections` (Starlight's code blocks); Docusaurus
`theme-classic/src/theme/CodeBlock/*`; rehype-pretty-code `packages/core/src`. Bug history:
GitHub issue search over those trackers plus Starlight, Nextra and Shiki (~150 hits, ~25 read).

## Pattern

- WAI-ARIA APG: **none** for a code block. It is a `pre` (role `generic`, or `code` for the
  inner `<code>`), plus standard patterns for its controls: a **button** (copy), a **toggle
  button** (`aria-pressed`, wrap), a **disclosure** (collapse/expand), **tabs** (files).
- Roles and attributes: no role on the block itself; a scrollable `pre` that is a keyboard tab
  stop needs an accessible name or it is announced as an unnamed group/region in some screen
  readers (axe `scrollable-region-focusable` requires focusability, not a name; a name helps).
- Keyboard: Tab reaches the copy button, the toggles and — when it overflows — the scroll area
  itself (arrow keys scroll it; WCAG 2.1.1, axe `scrollable-region-focusable`). Tabs follow the
  APG tabs pattern (handled by Tabs).

## How the others built it

### Chakra UI v3 (CodeBlock, built on Ark's Clipboard)

- Source: `code-block/code-block.tsx`, `adapters.ts`, `use-code-highlight.ts`.
- API: `CodeBlock.Root` (`code`, `language`, `meta: { highlightLines, focusedLineNumbers,
  addedLineNumbers, removedLineNumbers, showLineNumbers, wordWrap, colorScheme }`, `maxLines`,
  `copyTimeout`), `Header`, `Title`, `Control`, `CopyTrigger` + `CopyIndicator`,
  `CollapseTrigger` + `CollapseIndicator` + `CollapseText`, `Content`, `Code`, `CodeText`,
  `Overlay`. Highlighting through an **adapter** (`createShikiAdapter`,
  `createHighlightJsAdapter`, `plainTextAdapter`) provided by context; the adapter returns HTML
  that is injected with `dangerouslySetInnerHTML`. Line metadata (`data-line`,
  `data-highlight`, `data-diff`, `data-focused`) is added by a Shiki transformer.
- State: `useControllableState` for `collapsed` (default `codeLines > maxLines`); copy through
  Ark's clipboard machine.
- Notable: the adapter boundary (highlighter outside the component) is the right shape; `pre`
  gets `tabIndex: 0` always.
- Problems: the collapse trigger changes its `aria-label` ("Expand code block" / "Collapse code
  block") **and** sets `aria-expanded` — the state is spoken twice and the name changes under
  the user; `tabIndex=0` even when nothing overflows adds a useless tab stop; line metadata is
  produced by the highlighter, so it is lost with a plain-text or non-Shiki adapter;
  chakra-ui#10239 (highlight background disappears when the row scrolls horizontally: the line
  box is only as wide as the viewport), #10385 / #10536 (very long rows overflow the layout),
  #10334 (some meta numbers 0-based, others 1-based), #10303 (no horizontal scrollbar).

### Zag / Ark Clipboard (the copy machine Chakra uses)

- Source: `clipboard.machine.ts`, `clipboard.connect.ts`, `clipboard.dom.ts`.
- States `idle` → `copied` (timeout 3000 ms via `setRafTimeout`) → `idle`. `COPY` transitions to
  `copied` and **then** calls `writeToClipboard` without awaiting it: the UI says "copied" even
  when the write was rejected. No error state, no error callback.
- Fallback when `navigator.clipboard.writeText` is missing: a `pre` appended to the document,
  selected and `document.execCommand("copy")`.
- Announcement: only the trigger's `aria-label` (`translations.triggerLabel(copied)`) — a name
  change that most screen readers do not announce while focus stays on the button.

### Mantine CodeHighlight

- Source: `CodeHighlight/CodeHighlight.tsx`, `CodeHighlightTabs/`.
- Props: `code`, `language`, `copyLabel` / `copiedLabel` (a Tooltip), `expanded` /
  `defaultExpanded` / `onExpandedChange`, `maxCollapsedHeight`, `withExpandButton`,
  `expandCodeLabel` / `collapseCodeLabel`; highlighted HTML injected with
  `dangerouslySetInnerHTML`; highlighter through an adapter provider (highlight.js, Shiki).
- Collapse is a CSS `max-height` with `data-collapsed`, expanded by a full-width button.
- Problems: mantine#7816 (copy tooltip clipped by the code box's `overflow`), #5794 (scrolling
  issues inside a modal), #5099 (unknown language throws in the highlighter), #4879 (bundle
  size when the highlighter is bundled).

### Expressive Code (Starlight)

- Source: `plugin-frames/src/index.ts` + `copy-js-module.ts`, `plugin-line-numbers`,
  `plugin-text-markers`, `plugin-collapsible-sections`.
- Server-rendered HTML with a small inline script for copy. The copy button carries the code in
  a `data-code` attribute; on click it awaits `navigator.clipboard.writeText`, falls back to a
  hidden `pre` + `execCommand('copy')`, and only on success appends a feedback node into a
  **pre-existing `aria-live="polite"` region** next to the button (the region exists before the
  message, so it is announced).
- Line numbers are separate `div.ln` elements with `aria-hidden="true"` in a gutter; the gutter
  width is set from the largest number (`--lnWidth: Nch`).
- Collapsible sections are `<details>`/`<summary>` (native disclosure, works without JS).
- Notable: the most accessible copy feedback of the set, and no-JS reading.
- Problems: expressive-code#181 (copy not working — the inline script blocked by CSP/hydration),
  #98 (no wrap option for a long time), #351 / #315 (line-number CSS missing in some
  integrations: styles coupled to a build step).

### Docusaurus CodeBlock

- Source: `theme/CodeBlock/{Content,Line,Buttons/CopyButton,Buttons/WordWrapButton}`.
- `pre` with `tabIndex={0}` always; lines rendered by prism-react-renderer; **line numbers by CSS
  counters** (`counter-increment: line-count` on the line, `content: counter(line-count)` on a
  `::before` of a dedicated span) — never in the text, so never copied or read; highlighted
  lines by a class from magic comments.
- Copy: `navigator.clipboard.writeText` when defined, else a dynamic import of
  `copy-text-to-clipboard`; `isCopied` for 1 s; feedback by changing the button's
  `aria-label` ("Copied") — same weakness as Zag.
- Word wrap: a button with only an `aria-label` and a class for its state — the state is not
  exposed (`aria-pressed` missing).
- Problems: docusaurus#11791 (`writeText` of undefined on non-HTTPS: the check ran too late),
  #11414 (copy loses indentation: the copied text was rebuilt from the rendered tokens), #11109
  (copy does nothing inside a modal `<dialog>`: the fallback's hidden node is appended to
  `body`, outside the top layer, so the selection fails), #7907 (line numbers misaligned when
  word wrap is on), #10821 (copy and wrap buttons nearly invisible — contrast), #11646 (Voice
  Access shows two numbers for the same control: duplicated accessible targets), #3030 (site
  unusable without JavaScript).

### rehype-pretty-code / Shiki transformers

- Build-time highlighting to HAST; `data-line`, `data-highlighted-line`, `data-line-numbers`
  (numbers drawn by CSS counters), character highlights.
- Problems: rehype-pretty-code#157 (empty lines not rendered: an empty `span` collapses, line
  count and numbers shift), #180 (CRLF input splits into extra lines), #238 / #245 (highlight
  ranges off by one).

### Not shipped

Radix, React Aria, Base UI, Headless UI, Ariakit, Reka, Bits, Kobalte ship no code block;
Ark ships Clipboard only.

## Accessibility

Applying [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md):

- **Semantics.** `<pre><code>` is the right markup: screen readers read it as text (with
  "code" role in some), browsers preserve whitespace, copy/paste and find-in-page work. No
  `role` on the block. One `<code>` per block (not per line) so the reading is continuous.
- **Scrollable region.** When the content overflows horizontally (or vertically, if capped),
  the `pre` must be keyboard-focusable (`tabindex="0"`) — axe `scrollable-region-focusable`,
  WCAG 2.1.1 — and should be named (`aria-labelledby` the Title, else `aria-label` from
  messages "Code") so the tab stop is not an unnamed group. When nothing overflows it must
  **not** be a tab stop (Chakra/Docusaurus always add one). Overflow is only known on the
  client: the server renders without `tabindex`, then a measurement adds it — reading never
  needs it, and the measurement re-runs on resize and wrap.
- **Line numbers** are presentation: never in the text content (so never copied, selected or
  read). CSS counters (Docusaurus, rehype-pretty-code) do this with zero DOM; a gutter element
  with `aria-hidden` + `user-select: none` (Expressive Code) is the fallback when numbers must
  start elsewhere (`startLineNumber`) — CSS `counter-reset: line N` covers that too.
- **Highlighted lines** are visual emphasis; colour alone fails WCAG 1.4.1. The line carries
  `data-highlighted` for styling and the theme adds a non-colour cue (a border/marker); for AT,
  a visually hidden prefix is noisy on every line, so the meaning is given once: the block's
  description lists the highlighted lines (`messages.highlighted({ lines })` → "Lines 3–5 are
  highlighted"), referenced by `aria-describedby` on the `pre`. Diff lines (added/removed)
  follow the same rule (`del`/`ins`-like meaning needs text, not colour) — a non-goal for v1
  beyond `data-*` hooks.
- **Copy button**: a real `button`, named from content or `messages.copy` ("Copy code"), the
  name **does not change** on copy. Success and failure are announced through rind-ui's
  **Announcer** (polite, keyed per block), like Expressive Code's pre-existing live region and
  unlike Zag/Docusaurus's renamed button. The visible "Copied" state is `data-state="copied"`
  for a fixed time; a failure shows `data-state="error"` and announces `messages.copyFailed`.
- **Wrap toggle**: a toggle button (`aria-pressed`), name constant ("Wrap lines").
- **Collapse**: a disclosure — the trigger has `aria-expanded` and `aria-controls`, the name
  constant ("Show all lines" / no state words); collapsed content stays in the DOM (copy and
  find-in-page still reach it: `hidden="until-found"` cannot apply to a partially visible
  block, so collapse is a max-height clip with the full text still in the tree, and the copy
  button copies the full code). A screen reader reads the whole code regardless; the collapse
  is visual.
- **Tabs (files)**: rind-ui's Tabs; each panel is a code block; the tab label is the file name.
- **Forced colors**: highlighted lines need a system-colour border (`Highlight`), the copy
  button a `ButtonText` border; token colours fall back to `CanvasText` (that's the browser's
  default; do not set `forced-color-adjust: none`).
- **Motion**: the copied/expand transitions respect `prefers-reduced-motion`.
- **RTL**: code is LTR content: the `pre` gets `dir="ltr"` regardless of page direction (code
  in an RTL page must not flip; header and controls follow the page).
- **Contrast**: copy/wrap buttons over code backgrounds (docusaurus#10821) — the theme checks
  them against the code surface tokens.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag/Ark | clipboard.machine.ts | "Copied" shown when the write failed | `copied` entered before `writeText` resolves; no error path | — | Copy result is async: `copying` → `copied` \| `error`, decided by the promise |
| Docusaurus | #11791 | `Cannot read properties of undefined (reading 'writeText')` on HTTP | Clipboard API absent outside secure contexts | Fixed (check first) | Detect `navigator.clipboard?.writeText`, else the fallback |
| Docusaurus | #11109 | Copy does nothing inside a modal `<dialog>` | Fallback node appended to `body`, outside the top layer / inert page | Fixed | The fallback node goes next to the trigger (inside the same layer) |
| Docusaurus | #11414 | Copied code loses indentation | Text rebuilt from rendered tokens | Fixed | Copy the source string the consumer passed, never `innerText` of the render |
| Docusaurus | #7907 | Line numbers misaligned with word wrap | Numbers in a separate column not tied to wrapped lines | Fixed | Number each line on the line itself (counter on the line box) |
| Docusaurus / Zag | CopyButton, clipboard.connect | Copy feedback not announced | Only the button's `aria-label` changes | Open | Announce through a live region (Announcer), keep the name |
| Docusaurus | WordWrapButton | Wrap state not exposed | No `aria-pressed` | Open | Toggle button semantics |
| Docusaurus | #10821 | Copy/wrap buttons almost invisible | Contrast against the code background | Fixed | Theme contrast check on code surfaces |
| Docusaurus | #3030 | Site unusable without JS | Client-rendered features | Open | Reading needs no JS; controls enhance |
| Chakra | code-block.tsx | State spoken twice, name changes | Collapse trigger swaps `aria-label` and sets `aria-expanded` | — | Constant name + `aria-expanded` |
| Chakra / Docusaurus | `tabIndex: 0` always | Extra tab stop when nothing scrolls | Unconditional `tabIndex` | — | Tab stop only when it overflows |
| Chakra | #10239 | Highlight background disappears on horizontal scroll | Line boxes as wide as the viewport | Fixed | Lines are `min-inline-size: 100%` of the scroll width (grid / `width: max-content`) |
| Chakra | #10385, #10536, #10303 | Long rows break the layout / no scrollbar | No `overflow-x` / min-width in flex parents | Fixed | Root `min-inline-size: 0`, `pre` `overflow: auto` |
| Chakra | #10334 | Some line indices 0-based, others 1-based | Mixed conventions in meta | Fixed | Lines are 1-based everywhere in the API |
| Mantine | #7816 | Copy tooltip clipped | Tooltip inside the overflow box | Fixed | Feedback is not positioned inside the scroller (announcement + state) |
| Mantine | #5794 | Scroll issues inside a modal | Nested scroll containers + scroll lock | Fixed | The `pre` is its own scroll container; nothing locks it |
| Mantine | #5099 | Unknown language throws | Highlighter called on an unknown language | Fixed | Highlighting is the consumer's; the component never calls a highlighter |
| Expressive Code | #181 | Copy button not working | Inline script blocked / not hydrated | Fixed | Copy wiring is part of the React part, no inline script |
| rehype-pretty-code | #157 | Empty lines disappear (numbers shift) | Empty line element collapses | Fixed | An empty line renders a zero-width content (`\n` kept) and keeps its height |
| rehype-pretty-code | #180 | CRLF splits into extra lines | Split on `\n` only after `\r` | Fixed | Normalise `\r\n` → `\n` before splitting (copy uses the original string) |
| rehype-pretty-code | #238, #245 | Highlight ranges off by one | Range parsing | Open | 1-based inclusive ranges, tested at both ends |
| Docusaurus | #11646 | Voice Access shows two numbers for one control | Duplicated actionable elements | Open | One actionable element per control |

## Known pitfalls

- Copy feedback that is not announced, or announced before the write succeeds.
- Clipboard API missing (insecure context, old WebView, some iframes without
  `clipboard-write`); the `execCommand` fallback must run in the same layer as the trigger.
- Copying the rendered text (token spans, line numbers, zero-width characters) instead of the
  source string.
- Tab stop on every block, or none on blocks that scroll.
- Line numbers in the text (copied, read, selected) or misaligned under wrap.
- CRLF and trailing newline handling (an extra empty last line).
- Highlighted HTML from the consumer is HTML: trusted input. Escaping is the highlighter's job
  (highlight.js, Shiki and lezer-based renderers escape); the component must type it so it's
  obviously opt-in.
- Hydration: highlighted HTML rendered on the server must equal the client's, or React
  re-renders it (mismatch warnings) — the HTML is passed as data, so it is stable.

## Testing notes

- Clipboard: inject a fake through the Environment (`env.clipboard.writeText`), so node tests
  assert success, rejection, absence (fallback) and timing with fake time; one browser test
  with the real API where the engine allows it (Chromium with permissions), and one in a
  `<dialog>`.
- Overflow tab stop: browser test (layout), with and without wrap, and after a resize.
- Line numbers not copied: select-all + copy in the browser and compare with the source.
- No-JS reading: SSR test — the server HTML contains the full code, line structure, the
  highlighted-lines description, and no element depends on hydration to show text.
- Announcements through the announcement log (copied / failed, once per press).
- Driver: actions `copy`, `toggleWrap`, `toggleExpanded`, `selectFile`; queries `text`
  (source), `lineCount`, `highlightedLines`, `isWrapped`, `isExpanded`, `isScrollable`,
  `copyState`.

## Decisions

- **Parts**: `CodeBlock.Root` (`div`), `Header`, `Title` (names the block), `CopyTrigger`
  (button), `WrapTrigger` (toggle button), `CollapseTrigger` (disclosure button), `Content`
  (the `pre`, scroll container, `dir="ltr"`), `Code` (the `code`), `Line` (one per line,
  rendered by `Code` from the input, or by the consumer), `Files` (a Tabs Root for several
  files, each `File` a Tabs Trigger + Panel holding a block). Indicator content (icons, "Copied")
  is the consumer's, styled by `data-state`.
- **Input** (highlighter-agnostic):
  - `code: string` — the source, always required; it is what Copy writes and what the
    no-highlight render shows.
  - `lines?: readonly CodeLine[]` — tokens: `{ tokens: readonly { text: string; className?:
    string; style?: CSSProperties }[] }[]`, rendered as spans (safe, no HTML).
  - `html?: TrustedCodeHtml` — pre-highlighted HTML **per line** (`readonly string[]`, one entry
    per source line) or for the whole block (`string`, split on `\n` by the component), wrapped
    in a branded type created by `trustedCodeHtml(value)`, so passing raw strings fails to
    compile and the docs say: only highlighter output, never user input.
  - An adapter example (site only, not a dependency): highlight.js → `trustedCodeHtml(lines)`.
- **Machine**: `code-block` — `copy` sub-state `idle | copying | copied | error` (copied/error
  return to idle after `copyFeedbackDuration`, default 2000 ms, through the scheduler); `wrap`
  boolean (controllable `wrapped`), `expanded` boolean (controllable, default collapsed iff
  `maxLines` is set and the block is longer); `scrollable` from a measurement effect. Events
  `COPY`, `COPY.DONE`, `COPY.FAILED`, `COPY.RESET`, `WRAP.TOGGLE`, `EXPAND.TOGGLE`,
  `OVERFLOW.CHANGE`. Announcements through the Announcer: `messages.copied` /
  `messages.copyFailed`, polite, keyed per block.
- **Environment**: a new injected capability `clipboard.writeText(text, { near?: Element })`
  (DOM implementation: Clipboard API, else the `execCommand` fallback with the hidden node
  inserted next to `near`, inside its layer); fake in tests.
- **`data-*`**: Root `data-state` (copy), `data-wrapped`, `data-expanded`, `data-collapsible`,
  `data-scrollable`; Line `data-line="N"` (1-based), `data-highlighted`; CopyTrigger
  `data-state="idle|copying|copied|error"`; Content `data-line-numbers` when on.
- **Line numbers**: CSS counters (`counter-reset: rind-line <start-1>` on Code, `counter-increment`
  on Line, number drawn by the theme's `::before`), so they are never text; `lineNumbers` and
  `startLineNumber` props set `data-line-numbers` and the counter start.
- **SSR**: everything visible renders on the server; the tab stop on Content is added after a
  client measurement; Copy and the toggles are rendered as enabled buttons on the server and
  work once hydrated (pressing before hydration does nothing, as for every rind-ui button).
- **Contract**: locate by Content's name (Title) or `data-instance`; actions and queries as in
  Testing notes.
- **Deliberately different**: constant names + announcements (not renamed buttons); copy result
  decided by the promise; tab stop only when scrollable; highlighting entirely outside; HTML
  input branded as trusted; numbers never in the text.

## Open questions

- A new Environment capability (`clipboard`) touches shared infrastructure — confirm with the
  coordinator (it is also what a future Clipboard component and QR Code's copy would use).
- Diff lines (added/removed) and focus lines: `data-*` hooks only in v1, or with a text
  alternative (visually hidden "added"/"removed" per line)?
- Should `Files` be its own part, or should consumers compose `Tabs` + `CodeBlock` themselves
  (the site's example frame already uses Tabs)? Proposed: a thin `CodeBlock.Files` wrapper that
  is just Tabs with the right defaults, since the user asked for "Tabs for multiple files".

## Addendum (2026-10-18): built-in highlighting

The user rejected the highlighter-agnostic v1 in review of PR #151: "no highlighting per
language… the highlighting should live directly in the component's code and let you pick the
colours at most". This reverses "highlighting entirely outside" above. The `lines`/`html` input
stays as an escape hatch for external highlighters.

### How small highlighters tokenize

- **sugar-high** (~1 KB, JS/JSX; `packages/sugar-high/lib/core.js`): one hand-written loop over
  an index, no grammar. Each branch eats a run (whitespace, word, quoted string to the matching
  quote with `\` escapes, comment via hooks); words are classified after the fact (keyword set,
  after `.` → property, capitalised → class). `\n` is its own break token; multi-line strings
  and comments are single tokens split per line by the renderer. It does **not** tell regex
  from division (`/` is always a sign), does not parse `${…}` (an inner backtick ends the
  string), and has no JSX-text state (JSX text is coloured as code). Linear and tiny, at the
  cost of those three cases.
- **Prism** (`components/prism-core.js`): a grammar is an ordered map `type → RegExp |
  { pattern, lookbehind, greedy, inside, alias }`. `matchGrammar` walks a linked list of text
  nodes and, per pattern, splits unmatched strings around matches; `inside` re-tokenizes a
  token with a nested grammar; `greedy` matches over the remaining text (so a string can swallow
  something an earlier pattern took) and triggers a bounded rematch (`cause`/`reach` guard).
  Cost is patterns × nodes × regex cost; greedy patterns rescan the rest of the text. Regex vs
  division is a lookbehind on the previous character/keyword; template interpolation is a regex
  with a fixed nesting depth. No state stack, so JSX text and deep `${}` are approximations.
  Prism shipped ReDoS fixes in grammars (CVE-2021-23341, fixed 1.23.0; CVE-2021-32723, fixed
  1.24.0): catastrophic backtracking from nested quantifiers like `(a|b+)+`.
- **highlight.js** (mode reference): a mode is `begin`/`end` with `contains` sub-modes, a mode
  **stack**, `keywords`, `endsWithParent`, `returnBegin`/`excludeEnd`. All `begin`s of the
  current mode are compiled into one alternation, so scanning is one regex per step. Output is
  one HTML string whose spans cross newlines (why `splitHtmlLines` closes and reopens tags).
  The stack handles nesting (template interpolation, JSX attribute expressions) that Prism
  cannot.
- **Heavy reference only**: **Shiki** runs VS Code's TextMate grammars (Oniguruma in WASM, or a
  JS regex engine) with per-line state; grammars are tens to hundreds of KB each. **Lezer** is an
  incremental LR parser generator (CodeMirror 6); exact but a parser per language. Both are far
  beyond a component's budget and stay behind the `lines`/`html` escape hatch.

### Known bugs and pitfalls

- **Template literals**: `${` opens code that may contain `}` of objects and nested backticks;
  a flat regex or "string to the next backtick" breaks (sugar-high, Prism's fixed depth). Needs
  a stack: backtick → template state, `${` → code state, `}` → back.
- **Regex vs division**: undecidable from the next characters alone (`a / b / c` vs `x = /b/c`).
  Every lexer uses the previous significant token: after an operand (identifier, number,
  string, `)`, `]`) `/` is division, else a regex literal starts.
- **JSX text**: `<div>don't</div>` — the `'` is text, not a string; without a JSX-children state
  it opens a string that runs to the next quote. TSX also has `a < b` and `f<T>()`; `<` starts
  a tag only where an operand would be expected and a name follows.
- **Nested strings and comments**: `"/* no */"`, `// "no"`, `'it\'s'`; the first construct to
  start wins and escapes are consumed in place.
- **Multi-line tokens**: block comments and template strings span lines; the per-line render
  must split them and keep the type on every piece (Shiki and sugar-high do; hljs leaves it to
  the consumer). Copy must still equal the source.
- **Performance**: backtracking regexes (nested quantifiers, unanchored lazy scans that fail at
  the end) make huge or unterminated input quadratic or exponential. Use sticky (`y`) patterns
  tried at one position, quantifiers over disjoint classes, and let unterminated constructs end
  at the line or input end (`(?:\*\/|$)`) so a scan never fails after consuming the rest.

### Decision

A Monarch/hljs-style **state-stack lexer** in pure TypeScript, no dependency: a grammar is a map
of states to ordered rules (`match` sticky RegExp, `token`, optional `push`/`pop`/`next`, and a
`when(prev)` guard for regex-vs-division and tag-vs-less-than). One rule tries at a time at the
current index; no match consumes one character as plain text. Built-in grammars: ts/tsx/js/jsx,
css, html, json, bash. Tokens render as `<span data-token>`; colours are theme custom
properties only.
