# Clipboard

Copies a value to the clipboard: a copy button, or a read-only field with a copy button at its end. The result comes from the write itself, never before it: `copying` while the browser's clipboard has not answered, then `copied` or `error`, announced politely ("Copied", "Copy failed") and shown by the Indicator. The write goes through the environment's clipboard (the Clipboard API, then a `execCommand` fallback next to the Trigger), so tests run it with `fakeClipboard`.

## When to use

- **Use it for** a value people paste elsewhere: an API key, an invite link, an install command, a colour, a recovery code.
- **Over a button with `navigator.clipboard.writeText`**: the write starts in the click's task (WebKit refuses one after an `await`), a failure is a visible and announced state instead of a false "Copied", a second press while a write is pending is ignored, the Trigger's name never changes (screen readers do not read a name change; the result is announced), and a copy of the whole read-only Input counts too.
- **Don't use it for** copying code blocks: [Code Block](code-block.md) has its own copy button with the same logic. Don't use it for editable text: a copy from a [Text Field](text-field.md) is the browser's own.

```tsx
import { Clipboard } from "@rind-ui/react"

<Clipboard.Root value={apiKey} onCopy={({ ok }) => track(ok)}>
  <Clipboard.Label>API key</Clipboard.Label>
  <Clipboard.Control>
    <Clipboard.Input />
    <Clipboard.Trigger>
      <Clipboard.Indicator />
    </Clipboard.Trigger>
  </Clipboard.Control>
</Clipboard.Root>
```

A bare copy button is `Root` and `Trigger`:

```tsx
<Clipboard.Root value="npm install @rind-ui/react">
  <Clipboard.Trigger>
    <Clipboard.Indicator />
  </Clipboard.Trigger>
</Clipboard.Root>
```

## API

<!-- api:clipboard -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Clipboard.Root` | `root` | `<div>`; holds the value and the state. |
| `Clipboard.Label` | `label` | `<label>`; names the Input and completes the Trigger's name. |
| `Clipboard.Control` | `control` | `<div>`; groups the Input and the Trigger (the themed field surface). |
| `Clipboard.Input` | `input` | `<input readonly>` showing the value. |
| `Clipboard.Trigger` | `trigger` | `<button type="button">`; copies on click. |
| `Clipboard.Indicator` | `indicator` | `<span aria-hidden="true">`; `children`, its `copied` prop while copied, its `failed` prop on error; else the provider's `copy`, `check` or `x` icon (`RindProvider icons`); else empty, and the theme draws the same Phosphor shapes. |
| `Clipboard.ValueText` | `value-text` | `<span>`; `children`, else the value. |

Only `Root` and `Trigger` are required. No part points at one that is not rendered: without a Label the Trigger is named "Copy" alone, without an Input the Label has no `for`. Every part carries `data-state` (`idle`, `copying`, `copied`, `error`) and `data-disabled`.

## The Trigger's name

The Trigger is named by `messages.copy` ("Copy"), then the Label when there is one: "Copy API key". The name is the same before, during and after a copy. When the Trigger shows text, set `messages.copy` to that text, so the visible label is in the name (WCAG 2.5.3):

```tsx
<Clipboard.Root value={link} messages={{ copy: "Copy link" }}>
  <Clipboard.Trigger>
    <Clipboard.Indicator />
    Copy link
  </Clipboard.Trigger>
</Clipboard.Root>
```

An `aria-label` on the Trigger replaces the whole default name.

## Copy states

| State | Meaning |
|---|---|
| `idle` | No copy in progress. |
| `copying` | The write has not settled; another press is ignored (one write at a time). |
| `copied` | The write succeeded, or the whole Input was copied by the user; "Copied" was announced. |
| `error` | The write failed (refused, or no clipboard at all); "Copy failed" was announced. |

`copied` and `error` return to `idle` after `copyFeedbackDuration` (2000 ms); a new result restarts it. `value` is read when the write starts, so the latest value is the one copied. `onCopy({ ok, error?, source })` is called once per result, `source` being `"trigger"` or `"input"`.

## The Input

Tab to the Input, or the press that focuses it, selects the whole value; later presses keep the native selection. A copy of the whole value with the platform shortcut is `copied` (source `"input"`, announced); a copy of part of it changes nothing.

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On the Trigger: copies the value. |
| Tab | To the Input: selects the whole value; Ctrl+C / ⌘C copies it. |

## Accessibility notes

- **Announced, not renamed.** The result is a polite announcement keyed per instance; the Trigger keeps its name and focus stays on it.
- **Failure is visible.** `error` is its own state, with the "Copy failed" announcement and the Indicator's x icon.
- **Not colour alone.** The theme's Indicator changes shape per state (copy, check, x); under forced colors it is painted with `ButtonText`.
- **Target size.** The theme's Trigger is at least 24 × 24 CSS px.

## Testing

```tsx
import { fakeClipboard, getClipboard } from "@rind-ui/testing"

const clipboard = fakeClipboard()
render(
  <RindProvider environment={{ clipboard }}>
    <Settings />
  </RindProvider>,
)
const key = getClipboard(screen, { label: "API key" })
await key.copy()
await key.settleCopy()
expect(await key.copyState()).toBe("copied")
expect(clipboard.copied).toEqual(["sk-123"])
clipboard.set("reject") // or "absent"
```

Contract actions: `copy`, `settleCopy` (waits for the write, advancing fake time when given), `copyFromInput`, `copyPartOfInput(n)`. Queries: `copyState`, `value`, `inputValue`, `triggerName`, `isDisabled`.

## Tested with

<!-- tested-with:clipboard -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
