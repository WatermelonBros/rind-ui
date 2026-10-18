## ADDED Requirements

### Requirement: Anatomy

A Code Block SHALL consist of `Root` (a `div`), an optional `Header` holding an optional
`Title` and the optional `CopyTrigger`, `WrapTrigger` and `CollapseTrigger` buttons, and
`Content` (a `pre`) holding `Code` (a `code`) with one `Line` per source line. `Files` and
`File` SHALL compose several blocks as Tabs (a Tabs Root, one Tabs Trigger named by the file
and one Tabs Panel holding a block per file). Every part SHALL accept the `render` prop and the
props of the element it renders.

#### Scenario: Minimal block

- **WHEN** `<CodeBlock.Root code={"const a = 1\nconst b = 2"}><CodeBlock.Content><CodeBlock.Code /></CodeBlock.Content></CodeBlock.Root>` is rendered
- **THEN** a `pre` containing one `code` with two lines and the text "const a = 1\nconst b = 2" is rendered, with no role on the `pre`

### Requirement: Highlighter-Agnostic Input

`Root` SHALL take the source as `code: string` (required) and MAY take highlighted content as
either `lines` (an array, one entry per source line, of token lists `{ text, className?, style? }`,
rendered as text spans) or `html` (a `TrustedCodeHtml` value, created only by
`trustedCodeHtml(value)` from a string or one string per line, injected as HTML). A plain
string SHALL NOT be assignable to `html` (compile error). Without `lines` and `html`, the
lines SHALL render the source as text. The component SHALL NOT call or depend on a
highlighter.

#### Scenario: Raw string rejected

- **WHEN** a consumer writes `<CodeBlock.Root code={src} html={"<span>x</span>"}>`
- **THEN** the code does not compile

#### Scenario: Tokens rendered as text

- **WHEN** `lines` contains a token whose text is `"<b>"`
- **THEN** the line shows the characters `<b>` and no `b` element is created

### Requirement: Line Model

The source SHALL be split into lines on `\n` after normalising `\r\n` and `\r` to `\n`; a
trailing newline SHALL NOT produce an extra empty last line; an empty line SHALL render with
the height of a line and SHALL count in the numbering. Line numbers in every API
(`highlightLines`, `startLineNumber`, `data-line`) SHALL be 1-based; `highlightLines` SHALL
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
tab stop (`tabindex="0"`) exactly while its content overflows; it SHALL be named by the
`Title` when present (`aria-labelledby`), else by `messages.label` ("Code"). Overflow SHALL be
measured on the client and re-measured on resize, on wrap changes and on expand changes; the
server HTML SHALL NOT carry `tabindex`.

#### Scenario: No useless tab stop

- **WHEN** a short block fits its container
- **THEN** pressing Tab from before the block moves past it without stopping on the `pre`

#### Scenario: Scrolling block is reachable (axe scrollable-region-focusable)

- **WHEN** a block with a line wider than its container is rendered
- **THEN** the `pre` is a tab stop named by the Title and the arrow keys scroll it

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

### Requirement: Files

`Files` SHALL be a Tabs Root whose `File` children each render a Tabs Trigger (named by the
file's `title`) and a Tabs Panel holding a Code Block; keyboard, selection and naming SHALL be
Tabs'. Each file's copy button SHALL copy that file's code.

#### Scenario: Two files

- **WHEN** `Files` holds `File title="app.tsx"` and `File title="styles.css"`
- **THEN** a tablist with tabs "app.tsx" and "styles.css" is rendered, and the visible panel's copy button copies that file's code

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
`data-state` (the copy state). Consumer `data-variant` / `data-size` / `data-tone` SHALL pass
through.

#### Scenario: Copy state styling hook

- **WHEN** a copy succeeds
- **THEN** CopyTrigger has `data-state="copied"` until the feedback duration ends, then `data-state="idle"`

### Requirement: Messages

Every AT-facing string SHALL come from the code-block `messages` (`label`, `copy`, `copied`,
`copyFailed`, `wrap`, `expand`, `highlighted({ lines })`), overridable per instance and through
the provider.

#### Scenario: Localised copy feedback

- **WHEN** the provider supplies an Italian `copied`
- **THEN** a successful copy announces the Italian text

### Requirement: Code Block Contract

The `code-block` contract SHALL locate a block by Content's name or by `data-instance` inside a
container; declare the actions `copy`, `toggleWrap`, `toggleExpanded`, and for `Files`
`selectFile(title)`; the queries `text` (the source), `lineCount`, `highlightedLines`,
`isWrapped`, `isExpanded`, `isScrollable` and `copyState`; and map the copy events to the
injected fake clipboard. The driver SHALL expose the announcements made since it was created.

#### Scenario: Driver copies and reads the result

- **WHEN** a test runs `await getCodeBlock(screen, { name: "app.tsx" }).copy()`
- **THEN** it resolves after the copy settles, `copyState()` is `"copied"`, and the announcement log has "Copied"
