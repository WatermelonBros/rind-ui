# Code Block

Source code shown as text: readable in the server HTML without JavaScript, with a copy button whose result is announced, line numbers that are never copied, highlighted lines that do not depend on colour, soft wrap, and a collapsed preview for long blocks. It does not highlight: pass tokens or your highlighter's HTML.

## When to use

- **Use it for** code samples in docs, snippets in a reader, configuration a user copies.
- **Over a bare `<pre>`**: copy that reports failure instead of claiming success, a tab stop only when the block scrolls (and a name for it), numbers outside the text, wrapped lines that keep their numbers aligned, and long blocks clipped without removing lines from the page.
- **Don't use it for** inline code in a sentence (use `<code>`), or for editing code (that is an editor).

```tsx
import { CodeBlock } from "@rind-ui/react"

<CodeBlock.Root code={source} lineNumbers highlightLines={[3, [5, 7]]}>
  <CodeBlock.Header>
    <CodeBlock.Title>app.ts</CodeBlock.Title>
    <CodeBlock.WrapTrigger />
    <CodeBlock.CopyTrigger />
  </CodeBlock.Header>
  <CodeBlock.Content />
</CodeBlock.Root>
```

## API

<!-- api:code-block -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `CodeBlock.Root` | `root` | `<div>` | Holds the source and the state. |
| `CodeBlock.Header` | `header` | `<div>` | Holds the Title and the triggers. |
| `CodeBlock.Title` | `title` | `<span>` | Names the scrollable content (`aria-labelledby`). |
| `CodeBlock.CopyTrigger` | `copy-trigger` | `<button>` | Copies `code` through the clipboard; named by its content, else "Copy code". The name never changes; the result is announced. |
| `CodeBlock.WrapTrigger` | `wrap-trigger` | `<button>` | A toggle button (`aria-pressed`) for soft wrap; else named "Wrap lines". |
| `CodeBlock.CollapseTrigger` | `collapse-trigger` | `<button>` | A disclosure button (`aria-expanded`, `aria-controls`) for blocks longer than `maxLines`; hidden otherwise. Else named "Show all lines". |
| `CodeBlock.Content` | `content` | `<pre>` | The scroll container (`dir="ltr"`). A named tab stop (`role="group"`) only while it overflows. Renders the `code` element and one Line per source line, or `children(line)` per line. |
| `(inside Content)` | `code` | `<code>` | Sets the line-number counter start. |
| `CodeBlock.Line` | `line` | `<span>` | One source line: tokens as text, or the line's trusted HTML. |
| `(inside Content)` | `description` | `<span>` | Visually hidden "Highlighted lines: …", the Content's description. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `code` | `string` | — | Required. The source: rendered when no highlight is given, and what Copy writes. |
| `lines` | `readonly (readonly CodeToken[])[]` | — | Highlighted tokens, one list per line (`{ text, className?, style? }`), rendered as text. |
| `html` | `TrustedCodeHtml` | — | Highlighter output from `trustedCodeHtml(html)`, injected per line. Never user input. |
| `lineNumbers` | `boolean` | `false` | Draws line numbers with a CSS counter (never in the text). |
| `startLineNumber` | `number` | `1` | The first line's number (`data-line`, `highlightLines` and the counter follow it). |
| `highlightLines` | `LineRanges` | — | Line numbers and inclusive ranges: `[3, [5, 7]]`. |
| `maxLines` | `number` | — | Longer blocks start collapsed to this many lines. |
| `wrapped` | `boolean` | — | Controlled soft wrap. |
| `defaultWrapped` | `boolean` | `false` | Uncontrolled initial wrap. |
| `onWrappedChange` | `(wrapped, details) => void` | — | WrapTrigger proposes the opposite value; `cancel()` vetoes it. |
| `expanded` | `boolean` | — | Controlled expansion (with `maxLines`). |
| `defaultExpanded` | `boolean` | — | Uncontrolled initial expansion; default: collapsed when longer than `maxLines`. |
| `onExpandedChange` | `(expanded, details) => void` | — | CollapseTrigger proposes the opposite value. |
| `copyFeedbackDuration` | `number` | `2000` | How long `copied` / `error` last (ms). |
| `onCopy` | `({ ok, error? }) => void` | — | The copy's result, after the write settled. |
| `messages` | `Partial<CodeBlockMessages>` | — | Overrides the strings (also through the provider). |
| `render` | `element \| (props, state) => element` | — | Substitutes the rendered element without changing behaviour. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "code-block" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-copy-state` | "idle", "copying", "copied" or "error". |
| `root` | `data-wrapped` | While lines wrap. |
| `root` | `data-expanded` | While every line shows (always, unless collapsed). |
| `root` | `data-collapsible` | The block is longer than `maxLines`. |
| `root` | `data-scrollable` | The content overflows its scroll container (measured on the client). |
| `header` | `data-scope` | "code-block" |
| `header` | `data-part` | "header" |
| `header` | `data-instance` | The instance id. |
| `title` | `data-scope` | "code-block" |
| `title` | `data-part` | "title" |
| `title` | `data-instance` | The instance id. |
| `copy-trigger` | `data-scope` | "code-block" |
| `copy-trigger` | `data-part` | "copy-trigger" |
| `copy-trigger` | `data-instance` | The instance id. |
| `copy-trigger` | `data-focus` | Focused. |
| `copy-trigger` | `data-focus-visible` | Keyboard focus. |
| `copy-trigger` | `data-state` | The copy state. |
| `wrap-trigger` | `data-scope` | "code-block" |
| `wrap-trigger` | `data-part` | "wrap-trigger" |
| `wrap-trigger` | `data-instance` | The instance id. |
| `wrap-trigger` | `data-focus` | Focused. |
| `wrap-trigger` | `data-focus-visible` | Keyboard focus. |
| `wrap-trigger` | `data-state` | "on" or "off". |
| `collapse-trigger` | `data-scope` | "code-block" |
| `collapse-trigger` | `data-part` | "collapse-trigger" |
| `collapse-trigger` | `data-instance` | The instance id. |
| `collapse-trigger` | `data-focus` | Focused. |
| `collapse-trigger` | `data-focus-visible` | Keyboard focus. |
| `collapse-trigger` | `data-state` | "open" or "closed". |
| `content` | `data-scope` | "code-block" |
| `content` | `data-part` | "content" |
| `content` | `data-instance` | The instance id. |
| `content` | `data-wrapped` | While lines wrap. |
| `content` | `data-expanded` | While every line shows (always, unless collapsed). |
| `content` | `data-collapsible` | The block is longer than `maxLines`. |
| `content` | `data-scrollable` | The content overflows its scroll container (measured on the client). |
| `content` | `data-line-numbers` | With `lineNumbers`. |
| `code` | `data-scope` | "code-block" |
| `code` | `data-part` | "code" |
| `code` | `data-instance` | The instance id. |
| `line` | `data-scope` | "code-block" |
| `line` | `data-part` | "line" |
| `line` | `data-instance` | The instance id. |
| `line` | `data-line` | The line's number. |
| `line` | `data-highlighted` | Listed in `highlightLines`. |
| `description` | `data-scope` | "code-block" |
| `description` | `data-part` | "description" |
| `description` | `data-instance` | The instance id. |

### Keyboard

| Key | Action |
|---|---|
| Tab | Reaches the content only while it scrolls; the arrow keys then scroll it. |
| Enter, Space | On a trigger: copies, toggles wrap, or expands. |

### States

| State | Description |
|---|---|
| `idle` | No copy in progress. |
| `copying` | The clipboard write has not settled. |
| `copied` | The write succeeded; "Copied" was announced. Back to idle after `copyFeedbackDuration`. |
| `error` | The write failed; "Copy failed" was announced. Back to idle after `copyFeedbackDuration`. |

### Contract

| Action | Modalities |
|---|---|
| `copy` | pointer, keyboard, touch, virtual |
| `settleCopy` | pointer, keyboard, touch, virtual |
| `setWrapped` | pointer, keyboard, virtual |
| `setExpanded` | pointer, keyboard, virtual |

Queries: `text`, `lineCount`, `highlightedLines`, `isWrapped`, `isExpanded`, `isScrollable`, `copyState`. Traits: none.
<!-- /api -->

## Input: text, tokens or HTML

`code` is always required: it is what the block shows without highlighting, and the exact string Copy writes (tabs and indentation included, whatever the rendering).

- **Tokens** (`lines`): one list per source line of `{ text, className?, style? }`, rendered as text spans. Nothing is parsed as HTML, so this is the safe form.
- **HTML** (`html`): your highlighter's output, wrapped with `trustedCodeHtml(html)`. A plain string does not compile: the wrapper is the explicit opt-in. It is a marker, not a sanitizer: pass only what a highlighter produced from the source (highlighters escape it), never user input. One string is split per line, and an element that spans lines (a multi-line string or comment) is closed and reopened on each line, so every line parses on its own; you can also pass one string per line.

An adapter is a few lines. With highlight.js:

```tsx
import hljs from "highlight.js/lib/common"
import { trustedCodeHtml } from "@rind-ui/core"

const html = trustedCodeHtml(hljs.highlight(source, { language: "typescript" }).value)
<CodeBlock.Root code={source} html={html}>…</CodeBlock.Root>
```

The token colours are your highlighter's stylesheet.

## Lines

The source is split on newlines after turning `\r\n` and `\r` into `\n`; a trailing newline adds no empty last line, and empty lines keep their place and height. `CodeBlock.Content` renders one `CodeBlock.Line` per line, separated by newline text, so the text content, a selection and find-in-page match the source even without a stylesheet. Pass a function as Content's children to render each line yourself: `{(line) => <CodeBlock.Line line={line} data-diff={…} />}`.

- **Numbers** (`lineNumbers`, `startLineNumber`): a CSS counter drawn by the theme, never in the text, the copied text, a selection or the accessibility tree.
- **Highlighted lines** (`highlightLines={[3, [5, 7]]}`): line numbers as shown (they follow `startLineNumber`), ranges inclusive. Each gets `data-highlighted`, and the block is described by a hidden "Highlighted lines: 3, 5 to 7", so the emphasis is not colour alone.

## Copy

`CodeBlock.CopyTrigger` writes `code` through the environment's clipboard: the Clipboard API when the page has it, else a temporary selection copied next to the button (inside the same dialog or layer). The state is `copying` until the write settles, then `copied` or `error`, and back to `idle` after `copyFeedbackDuration` (2 s). "Copied" or "Copy failed" is announced politely; the button's name never changes, so it is not read twice. Style the feedback with `data-state` on the trigger or `data-copy-state` on the Root, and get the result with `onCopy({ ok, error })`.

The Clipboard API is missing in insecure contexts (plain HTTP) and can be refused (an iframe without `clipboard-write`); the fallback covers both, and when it fails too the block says so instead of claiming success.

## Wrap and collapse

- `CodeBlock.WrapTrigger` is a toggle button (`aria-pressed`) bound to `wrapped` / `defaultWrapped` / `onWrappedChange`. The theme wraps with `white-space: pre-wrap`; numbers stay on a wrapped line's first row.
- With `maxLines`, a longer block starts collapsed (`expanded` / `defaultExpanded` / `onExpandedChange`). `CodeBlock.CollapseTrigger` is a disclosure button (`aria-expanded`, `aria-controls`) with a constant name, hidden when the block is not longer than `maxLines`. Collapsed, the theme clips the content to `maxLines` lines; every line stays in the page, so copy, find-in-page and screen readers reach all of it.

## Scrolling and keyboard

`CodeBlock.Content` (the `pre`) is its own scroll container and always left-to-right, also in a right-to-left page (the Header follows the page). While its content overflows it is a tab stop, named by the Title (else "Code") as a `group`, so keyboard users can scroll it with the arrow keys; a block that fits is no tab stop. Overflow is measured on the client and again after a resize, a wrap change or an expansion; the server HTML has no tab stop.

## Several files

Use one block per Tabs panel: the tabs name the files, and each panel's copy button copies its own code.

```tsx
<Tabs.Root defaultValue="app">
  <Tabs.List aria-label="Files">
    <Tabs.Tab value="app">app.tsx</Tabs.Tab>
    <Tabs.Tab value="css">styles.css</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="app">
    <CodeBlock.Root code={app}>…</CodeBlock.Root>
  </Tabs.Panel>
  <Tabs.Panel value="css">
    <CodeBlock.Root code={css}>…</CodeBlock.Root>
  </Tabs.Panel>
</Tabs.Root>
```

## Server rendering

Everything you read is in the server HTML: the code, every line with `data-line`, the highlighted lines, their description, the title and the buttons. Copy and the toggles work once hydrated. HTML input is passed as data, so hydration matches.

## Messages

Every string that reaches assistive technology comes from `messages`: `label` ("Code"), `copy` ("Copy code"), `copied` ("Copied"), `copyFailed` ("Copy failed"), `wrap` ("Wrap lines"), `expand` ("Show all lines") and `highlighted(runs)` ("Highlighted lines: 3, 5 to 7"). The trigger messages name a trigger only when it has no content.

## Styling

The theme places Code Block in the decoration family (no variants or sizes). Tokens: `--rind-code-block-*` (background, text, border, radius, font size, leading, gutter width and colour, highlight background and border).

## Testing

```ts
import { fakeClipboard, getCodeBlock } from "@rind-ui/testing"

const clipboard = fakeClipboard()
render(
  <RindProvider environment={{ clipboard }}>
    <Example />
  </RindProvider>,
)
const block = getCodeBlock(screen, { title: "app.ts" })
await block.copy()
await block.settleCopy()
expect(await block.copyState()).toBe("copied")
expect(clipboard.copied).toEqual([source])
```

`fakeClipboard({ mode })` succeeds, rejects or behaves as absent (`set(mode)` changes it); with a `scheduler` (a virtual clock's) a write takes `latency` ms, so `copying` can be observed. The driver locates a block by its Title's text, or takes the only block in its target (a Tabs panel).

## Accessibility tree

A block with a title (generated from the state example):

<!-- aria:code-block--basic -->
```yaml
- text: example.tsx
- button "Copy"
```
<!-- /aria -->

## Tested with

<!-- tested-with:code-block -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
