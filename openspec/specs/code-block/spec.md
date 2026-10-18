# code-block Specification

## Purpose
TBD - created by archiving change add-code-block. Update Purpose after archive.
## Requirements
### Requirement: Anatomy

A Code Block SHALL consist of `Root` (a `div`), an optional `Header` holding an optional
`Title` and the optional `CopyTrigger`, `WrapTrigger` and `CollapseTrigger` buttons, and
`Content` (a `pre`), which renders a `code` element holding one `Line` per source line,
separated by newline text, or the consumer's `children(line)` per line. Several files SHALL be
composed with the existing Tabs (one block per Tabs Panel); there is no separate files part.
Every part SHALL accept the `render` prop and the props of the element it renders.

#### Scenario: Minimal block

- **WHEN** `<CodeBlock.Root code={"const a = 1\nconst b = 2"}><CodeBlock.Content /></CodeBlock.Root>` is rendered
- **THEN** a `pre` containing one `code` with two lines and the text "const a = 1\nconst b = 2" is rendered, with no role on the `pre` while it fits

### Requirement: Input

`Root` SHALL take the source as `code: string` (required) and MAY take a `language` (built-in
highlighting, see Built-in Highlighting) or, as the escape hatch for an external highlighter,
highlighted content as either `lines` (an array, one entry per source line, of token lists
`{ text, token?, className?, style? }`, rendered as text spans, `token` as `data-token`) or
`html` (a `TrustedCodeHtml` value, created only by
`trustedCodeHtml(value)` from a string or one string per line, injected as HTML; a single string
is split per line and an element spanning lines is closed and reopened on each line). A plain
string SHALL NOT be assignable to `html` (compile error). `lines` and `html` SHALL win over
`language`. Without `lines`, `html` and a known `language`, the lines SHALL render the source as
text. The component SHALL NOT depend on an external highlighter.

#### Scenario: Raw string rejected

- **WHEN** a consumer writes `<CodeBlock.Root code={src} html={"<span>x</span>"}>`
- **THEN** the code does not compile

#### Scenario: Tokens rendered as text

- **WHEN** `lines` contains a token whose text is `"<b>"`
- **THEN** the line shows the characters `<b>` and no `b` element is created

#### Scenario: Escape hatch wins

- **WHEN** `language="ts"` and `lines` are both given
- **THEN** the lines render `lines`, not the built-in tokens

### Requirement: Built-in Highlighting

`@rind-ui/core` SHALL highlight in pure TypeScript with no runtime dependency: `tokenize(code,
grammar)` and `highlightCode(code, grammar)` (tokens per line). `language` SHALL accept a
built-in name, case-insensitive (`ts`/`typescript`/`mts`/`cts`, `tsx`, `js`/`javascript`/`mjs`/
`cjs`, `jsx`, `css`, `html`, `json`/`jsonc`, `bash`/`sh`/`shell`/`zsh`) or a consumer
`CodeGrammar` (public type: states of ordered rules `{ match, token?, when?, push?, next?, pop? }`,
lexing from `root`). An unknown name SHALL render plain text. Tokens SHALL be rendered as
`<span data-token="<type>">` with the fixed, documented set `keyword | string | comment | number
| function | type | tag | attr | punctuation | operator | property | variable | regex`; plain text
SHALL NOT be wrapped. The concatenated text of a line's tokens SHALL equal the source line: tokens
SHALL NOT change the copied text, the line split, the line count or the numbers; a token spanning
lines (block comment, template string) SHALL be split per line and keep its type on each piece.
The lexer SHALL track template literals with nested `${}`, JSX text versus code, and regex versus
division by the previous significant token; it SHALL be linear in the input (each pattern tried at
one position, no catastrophic backtracking, unterminated constructs end at the line or input end).
Server HTML SHALL contain the tokens.

#### Scenario: Multi-line token keeps its type

- **WHEN** `language="ts"` and the code has a block comment over three lines
- **THEN** each of the three lines has a `data-token="comment"` span with that line's part

#### Scenario: Copy fidelity

- **WHEN** a highlighted block with CRLF newlines and tabs is copied
- **THEN** the clipboard receives exactly `code`

#### Scenario: JSX text is not a string

- **WHEN** `language="tsx"` and the code is `<p>don't</p>`
- **THEN** no `data-token="string"` span is created for `'t</p>`

#### Scenario: Large input

- **WHEN** 5,000 lines of mixed TSX, with an unterminated comment, are highlighted
- **THEN** it completes with 5,000 lines of tokens (completion and size asserted, never timing)

#### Scenario: Unknown language

- **WHEN** `language="cobol"`
- **THEN** the block renders plain text with no `data-token` span

### Requirement: Token Colours

The theme SHALL colour each token type through one custom property per type,
`--rind-code-token-<type>`, falling back to theme tokens `--rind-color-code-<type>` with light and
dark values; no JavaScript theme object. Picking colours SHALL mean overriding those properties.
The block SHALL default to a dark scheme (`--rind-code-block-scheme`, `light` or `dark`) that
every token inside it follows. Every default token colour SHALL reach 4.5:1 (WCAG 1.4.3) against
the block background and a highlighted line, in both schemes; under forced colors tokens SHALL use
`CanvasText`. The content SHALL have block padding, and the inline padding SHALL be on the lines,
so a highlighted line runs edge to edge, also in a right-to-left page.

#### Scenario: Override a colour

- **WHEN** a page sets `--rind-code-token-keyword: rgb(1, 2, 3)` above a block
- **THEN** keyword tokens are that colour

#### Scenario: Contrast

- **WHEN** a block with every token type and a highlighted line renders in the light and the dark scheme
- **THEN** every token colour is at least 4.5:1 on the block and on the highlighted line

### Requirement: Line Model

The source SHALL be split into lines on `\n` after normalising `\r\n` and `\r` to `\n`; a
trailing newline SHALL NOT produce an extra empty last line; an empty line SHALL render with
the height of a line and SHALL count in the numbering. Line numbers in every API
(`highlightLines`, `data-line`, the drawn number) SHALL be the displayed numbers: 1-based,
starting at `startLineNumber`; `highlightLines` SHALL
accept numbers and inclusive ranges (`[3, [5, 7]]`).

#### Scenario: Empty lines keep their place (regression: rehype-pretty-code#157)

- **WHEN** the code is `"a\n\nb"`
- **THEN** three lines are rendered with `data-line` 1, 2, 3 and the second has the height of a line

#### Scenario: CRLF (regression: rehype-pretty-code#180)

- **WHEN** the code is `"a\r\nb\r\n"`
- **THEN** two lines are rendered, "a" and "b"

#### Scenario: Range ends included (regression: rehype-pretty-code#238)

- **WHEN** `highlightLines={[[2, 4]]}` on a five-line block
- **THEN** lines 2, 3 and 4 carry `data-highlighted` and lines 1 and 5 do not

### Requirement: Line Numbers

With `lineNumbers`, Content SHALL carry `data-line-numbers` and the numbering SHALL start at
`startLineNumber` (default 1) through a CSS counter set on `Code`; line numbers SHALL NOT be
part of any element's text content, the copied text, the selection or the accessibility tree.

#### Scenario: Numbers are not copied

- **WHEN** a user selects the whole block with line numbers on and copies it
- **THEN** the clipboard holds the source without any line number

#### Scenario: Numbers follow wrapped lines (regression: docusaurus#7907)

- **WHEN** wrap is on and line 3 wraps onto two visual rows
- **THEN** the number 3 is drawn once, aligned with the first row of line 3, and line 4 is numbered 4

### Requirement: Highlighted Lines

Lines in `highlightLines` SHALL carry `data-highlighted`. When at least one line is highlighted,
Content SHALL be described (`aria-describedby`) by a visually hidden text from
`messages.highlighted({ lines })` (English default "Highlighted lines: 3, 5 to 7"), so the
emphasis is available without colour. The theme SHALL mark highlighted lines with a non-colour
cue and keep the cue under forced colors. A highlighted line's background SHALL span the full
scroll width.

#### Scenario: Meaning without colour

- **WHEN** lines 3 and 5–7 are highlighted
- **THEN** the `pre`'s accessible description is "Highlighted lines: 3, 5 to 7"

#### Scenario: Highlight on horizontal scroll (regression: chakra-ui#10239)

- **WHEN** a highlighted line is wider than the viewport and the block is scrolled to the end
- **THEN** the highlight background covers the visible part of the line

### Requirement: Scrollable Content

`Content` SHALL render `dir="ltr"`, SHALL be its own scroll container, and SHALL be a keyboard
tab stop (`tabindex="0"`) exactly while its content overflows on an axis the user can scroll;
while it is a tab stop it SHALL have `role="group"` (a generic `pre` may not be named) and be
named by the `Title` when present (`aria-labelledby`), else by `messages.label` ("Code");
otherwise it SHALL carry no role and no name. Overflow SHALL be
measured on the client and re-measured on resize, on wrap changes and on expand changes; the
server HTML SHALL NOT carry `tabindex`.

#### Scenario: No useless tab stop

- **WHEN** a short block fits its container
- **THEN** pressing Tab from before the block moves past it without stopping on the `pre`

#### Scenario: Scrolling block is reachable (axe scrollable-region-focusable)

- **WHEN** a block with a line wider than its container is rendered
- **THEN** the `pre` is a tab stop, a group named by the Title, and the arrow keys scroll it

#### Scenario: Code stays left-to-right

- **WHEN** a block is rendered in a `dir="rtl"` page
- **THEN** the `pre` has `dir="ltr"` and the Header follows the page direction

### Requirement: Copy

`CopyTrigger` SHALL be a button named by its content, else by `messages.copy` ("Copy code"),
and its name SHALL NOT change with the copy state. Pressing it SHALL write the `code` string
the consumer passed (never the rendered text) through the Environment's `clipboard`, with the
trigger as `near`. The copy state SHALL be `copying` until the write settles, then `copied` on
success or `error` on rejection or absence of any clipboard, returning to `idle` after
`copyFeedbackDuration` (default 2000 ms). Success SHALL be announced politely through the
Announcer with `messages.copied` ("Copied"), failure with `messages.copyFailed` ("Copy
failed"), keyed per block, once per press. `onCopy(details)` SHALL report the result. Pressing
again while `copied` SHALL copy again and restart the timer.

#### Scenario: Failure is not reported as success (regression: Zag clipboard machine)

- **WHEN** the clipboard write rejects
- **THEN** the state goes `copying` → `error`, "Copy failed" is announced, and "Copied" is never announced

#### Scenario: Insecure context (regression: docusaurus#11791)

- **WHEN** `navigator.clipboard` is undefined
- **THEN** the fallback copies the text and the state becomes `copied`, with no thrown error

#### Scenario: Copy inside a modal dialog (regression: docusaurus#11109)

- **WHEN** a block inside a modal `<dialog>` is copied with the fallback
- **THEN** the clipboard holds the code

#### Scenario: Indentation kept (regression: docusaurus#11414)

- **WHEN** a block whose code has tabs and leading spaces is copied
- **THEN** the clipboard holds the exact `code` string

#### Scenario: Announced, name unchanged

- **WHEN** a screen-reader user presses "Copy code" and the write succeeds
- **THEN** "Copied" is announced politely once and the button is still named "Copy code"

### Requirement: Wrap

`WrapTrigger` SHALL be a toggle button (`aria-pressed`) named by its content, else by
`messages.wrap` ("Wrap lines"), with a constant name. The wrap state SHALL be controllable
(`wrapped`, `defaultWrapped`, `onWrappedChange`); Root and Content SHALL carry `data-wrapped`
while on, and the theme SHALL wrap long lines (`white-space: pre-wrap`) without changing the
copied text.

#### Scenario: Wrap state exposed (regression: Docusaurus WordWrapButton)

- **WHEN** the wrap trigger is pressed
- **THEN** it has `aria-pressed="true"`, Content has `data-wrapped`, and the name is still "Wrap lines"

### Requirement: Collapse

With `maxLines`, a block longer than `maxLines` SHALL start collapsed (`expanded`,
`defaultExpanded`, `onExpandedChange` control it). `CollapseTrigger` SHALL be a disclosure
button with `aria-expanded` and `aria-controls` (Content), named by its content, else by
`messages.expand` ("Show all lines"), with a constant name. Collapsed, the theme SHALL clip
Content to `maxLines` lines (`--rind-code-block-max-lines`) while the full code stays in the
DOM, so copy, find-in-page and screen readers reach every line. A block not longer than
`maxLines` SHALL render no `data-collapsible` and the trigger SHALL be hidden.

#### Scenario: Constant name (regression: Chakra CollapseTrigger)

- **WHEN** a collapsed block is expanded with its trigger
- **THEN** the trigger's `aria-expanded` goes from "false" to "true" and its name does not change

#### Scenario: Collapsed text still complete

- **WHEN** a 40-line block with `maxLines={10}` is collapsed and copied
- **THEN** the clipboard holds all 40 lines

### Requirement: Several Files

Several files SHALL be shown as a Tabs composition: one Code Block per Tabs Panel, the tabs
naming the files; keyboard, selection and naming SHALL be Tabs'. Each block's copy button SHALL
copy that block's code, and the driver SHALL locate the only block inside a panel.

#### Scenario: Two files

- **WHEN** a Tabs has tabs "app.tsx" and "styles.css", each panel holding a block
- **THEN** after selecting "styles.css", the visible panel's copy button copies that file's code

### Requirement: Server Rendering

The server HTML SHALL contain the full code, every line with its `data-line`, the highlighted
lines' `data-highlighted`, the highlighted-lines description, the Title, the controls as
buttons, and `dir="ltr"` on Content; reading the code SHALL need no client JavaScript. Hydration
SHALL produce no mismatch, including with `html` input.

#### Scenario: No-JS reading

- **WHEN** the server HTML of a block with a title, line numbers and highlighted lines is loaded with JavaScript disabled
- **THEN** the code, its lines and the highlighted-lines description are present and readable

#### Scenario: Hydration with highlighted HTML

- **WHEN** a block with `html` input is server-rendered and hydrated in Strict Mode
- **THEN** no hydration warning is logged

### Requirement: Data Attributes

Every part SHALL carry `data-scope="code-block"`, its `data-part` and `data-instance`. Root
SHALL carry `data-copy-state` (`idle | copying | copied | error`), `data-wrapped`,
`data-expanded`, `data-collapsible` and `data-scrollable` (present-empty or absent); Content
`data-line-numbers` and `data-scrollable`; Line `data-line` and `data-highlighted`; CopyTrigger
`data-state` (the copy state); WrapTrigger `data-state` (`on | off`); CollapseTrigger
`data-state` (`open | closed`); the triggers `data-focus` and `data-focus-visible`. Token spans
carry only `data-token` (no scope attributes, to keep long blocks light). Consumer `data-variant` / `data-size` / `data-tone` SHALL pass
through.

#### Scenario: Copy state styling hook

- **WHEN** a copy succeeds
- **THEN** CopyTrigger has `data-state="copied"` until the feedback duration ends, then `data-state="idle"`

### Requirement: Messages

Every AT-facing string SHALL come from the code-block `messages` (`label`, `copy`, `copied`,
`copyFailed`, `wrap`, `expand`, `highlighted(runs)`), overridable per instance and through
the provider.

#### Scenario: Localised copy feedback

- **WHEN** the provider supplies an Italian `copied`
- **THEN** a successful copy announces the Italian text

### Requirement: Code Block Contract

The `code-block` contract SHALL locate a block by its Title's text, or as the only block in the
driver's target; declare the actions `copy`, `settleCopy` (waits until the write settled,
advancing fake time when the test uses it), `setWrapped(on)` and `setExpanded(on)`; the queries
`text` (the code's text, whitespace collapsed as adapters read text), `lineCount`,
`highlightedLines`, `isWrapped`, `isExpanded`, `isScrollable` and `copyState`; and map
`COPY.DONE` / `COPY.FAILED` to `settleCopy`, the outcome being the injected fake clipboard's.
`@rind-ui/testing` SHALL export `fakeClipboard({ mode, scheduler?, latency? })`. The driver SHALL
expose the announcements made since it was created.

#### Scenario: Driver copies and reads the result

- **WHEN** a test runs `copy()` then `settleCopy()` on `getCodeBlock(screen, { title: "app.tsx" })` with a succeeding fake clipboard
- **THEN** `copyState()` is `"copied"`, the fake holds the code, and "Copied" was announced

