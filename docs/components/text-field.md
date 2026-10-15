# Text Field

A native `<input>` or `<textarea>` with a controllable value, correct IME handling, a clear button, a character count and autosize, labelled, described and validated like any Field.

```tsx
import { TextField } from "@rind-ui/react"

<TextField.Root name="email" required>
  <TextField.Label>Email</TextField.Label>
  <TextField.Input type="email" autoComplete="email" />
  <TextField.Description>We never share it.</TextField.Description>
  <TextField.ErrorMessage />
</TextField.Root>
```

## API

<!-- api:text-field -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `TextField.Root` | `root` | `<div>` | A Field when not inside one; else it joins the enclosing Field. |
| `TextField.Label` | `label` | `<label>` | The Field's Label (not rendered inside a Field). |
| `TextField.Description` | `description` | `<p>` | The Field's Description (not rendered inside a Field). |
| `TextField.ErrorMessage` | `error-message` | `<p>` | The Field's ErrorMessage (not rendered inside a Field). |
| `TextField.Input` | `input` | `<input>` | A native `<input>`; every attribute is forwarded. |
| `TextField.Textarea` | `textarea` | `<textarea>` | A native `<textarea>`; `autosize` grows it with its content. |
| `TextField.ClearTrigger` | `clear-trigger` | `<button>` | Named "Clear", not in the Tab order; rendered only while there is something to clear. |
| `TextField.CharacterCount` | `character-count` | `<span>` | The count against `maxLength` or a soft `max`; in the control's description. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| null` | — | Controlled value (`null` renders empty). |
| `defaultValue` | `string` | — | Uncontrolled: the DOM owns the value. |
| `onValueChange` | `(value, { reason, event, isComposing }) => void` | — | Every change, with its reason (`INPUT`, `CLEAR`, `RESET`). Native `onChange` is forwarded untouched. |
| `focusableWhenDisabled` | `boolean` | `false` | Disabled but focusable: read-only + `aria-disabled`. |
| `countThreshold` | `number` | — | Announce the count at this many remaining (default max(10, 20% of the limit)). |
| `messages` | `{ clear?, charactersRemaining?, charactersOver? }` | — | The ClearTrigger name and count announcements. |
| `fieldMessages` | `Field messages` | — | The Field's messages when the Root is the Field. |
| `autosize` | `boolean` | `false` | On Textarea: grows with its content (native `field-sizing` where supported). |
| `max` | `number` | — | On CharacterCount: a soft limit (an error past it, never a truncation). |
| `count` | `(value) => number` | — | On CharacterCount: replaces the counter. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "text-field" (or a preset's scope) |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-disabled` | While disabled. |
| `root` | `data-readonly` | While read-only. |
| `root` | `data-required` | While required. |
| `root` | `data-valid` | A valid result is displayed (Field). |
| `root` | `data-invalid` | An error is displayed (Field). |
| `root` | `data-validating` | An async check is running (Field). |
| `root` | `data-touched` | Focus has left it once (Field). |
| `root` | `data-dirty` | The value differs from the first one (Field). |
| `root` | `data-filled` | The value is not empty (Field). |
| `root` | `data-focus` | The control has focus. |
| `root` | `data-focus-visible` | The control has keyboard focus. |
| `root` | `data-composing` | An IME composition is in progress. |
| `input` | `data-scope` | "text-field" (or a preset's scope) |
| `input` | `data-part` | "input" |
| `input` | `data-instance` | The instance id. |
| `input` | `data-disabled` | While disabled. |
| `input` | `data-readonly` | While read-only. |
| `input` | `data-required` | While required. |
| `input` | `data-valid` | A valid result is displayed (Field). |
| `input` | `data-invalid` | An error is displayed (Field). |
| `input` | `data-validating` | An async check is running (Field). |
| `input` | `data-touched` | Focus has left it once (Field). |
| `input` | `data-dirty` | The value differs from the first one (Field). |
| `input` | `data-filled` | The value is not empty (Field). |
| `input` | `data-focus` | Focused. |
| `input` | `data-focus-visible` | Keyboard focus. |
| `input` | `data-composing` | Composing. |
| `character-count` | `data-scope` | "text-field" (or a preset's scope) |
| `character-count` | `data-part` | "character-count" |
| `character-count` | `data-instance` | The instance id. |
| `character-count` | `data-disabled` | While disabled. |
| `character-count` | `data-readonly` | While read-only. |
| `character-count` | `data-required` | While required. |
| `character-count` | `data-valid` | A valid result is displayed (Field). |
| `character-count` | `data-invalid` | An error is displayed (Field). |
| `character-count` | `data-validating` | An async check is running (Field). |
| `character-count` | `data-touched` | Focus has left it once (Field). |
| `character-count` | `data-dirty` | The value differs from the first one (Field). |
| `character-count` | `data-filled` | The value is not empty (Field). |
| `character-count` | `data-over-limit` | The count exceeds the limit. |

### Keyboard

| Key | Action |
|---|---|
| Enter | In an Input: commits the value (Field), unless an IME is composing. |
| ⌘/Ctrl + A, Backspace | Native editing; nothing is overridden. |

### States

| State | Description |
|---|---|
| `idle` | Not composing: changes validate, count and announce. |
| `composing` | An IME composition: changes are reported (`isComposing`), never validated, counted or announced. |

### Contract

| Action | Modalities |
|---|---|
| `type` | pointer, keyboard, virtual |
| `fill` | keyboard |
| `clear` | pointer, keyboard, virtual |
| `compose` | keyboard |
| `composeOpen` | keyboard |
| `composeEnd` | keyboard |
| `blur` | keyboard |
| `reset` | pointer, keyboard, virtual |

Queries: `value`, `name`, `description`, `isInvalid`, `isDisabled`, `isReadOnly`, `isRequired`, `errors`, `characterCount`, `isClearable`, `isComposing`. Traits: `field-associated`.
<!-- /api -->

## Text Field or Field?

`TextField.Root` **is a Field** when it is not inside one: its Label, Description and
ErrorMessage are a Field's, and it takes the Field's props (`required`, `validate`,
`validationMode`, …). Inside a [Field](field.md) it only joins it: use the Field's Label,
Description and ErrorMessage (the Text Field's own render nothing and warn).

## Value

- **Uncontrolled** (`defaultValue`): the input owns its value, exactly like a plain input.
  rind-ui reads it from `input` events and after a form reset, and writes it only for a
  Clear.
- **Controlled** (`value`): the input shows the prop; `null` renders as empty.
- `onValueChange(value, { reason, event, isComposing })` reports every change, with
  `reason` `INPUT`, `CLEAR` or `RESET`. Your native `onChange` is forwarded untouched.

## IME composition

While an IME composes (Japanese, Chinese, Korean), the Text Field never writes the value
or the selection, and does not validate, count or announce. `onValueChange` still runs for
each update with `isComposing: true`; the committed value is validated and counted once.
Enter that commits a composition is never treated as Enter.

Shortcuts of your own need the same guard:

```tsx
<TextField.Root>
  <TextField.Label>Message</TextField.Label>
  <TextField.Textarea
    onKeyDown={(e) => {
      // Cmd/Ctrl+Enter submits, but never while an IME is composing.
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing && e.keyCode !== 229) {
        e.currentTarget.form?.requestSubmit()
      }
    }}
  />
</TextField.Root>
```

## Clear button

`TextField.ClearTrigger` is named "Clear", is not in the Tab order (keyboard users select
and delete), and is rendered only while there is something to clear and the field is
editable. Pressing it keeps focus in the input, and clears through the same path as typing:
one `input` event, `onValueChange("", { reason: "CLEAR" })`, a Field validation. A Clear
loses the browser's native undo step for that change.

## Character count

`TextField.CharacterCount` shows the count against the input's `maxLength` (a hard limit)
or its own `max` (a soft limit: going over is an error, never a truncation). It counts what
`maxLength` counts: UTF-16 code units, a line break counts once. It is part of the input's
description, not a live region; near the limit, while focused, the remaining count is
announced once after a typing pause.

## Autosize

`<TextField.Textarea autosize rows={2} />` grows with its content between `rows` and your
`max-block-size`, then scrolls. See [Autosize](../guides/autosize.md).

## Testing

```tsx
import { getTextField } from "@rind-ui/testing"

const email = getTextField(screen, { name: "Email" })
await email.fill("a@b.co")
expect(await email.value()).toBe("a@b.co")
await email.compose("てすと", "テスト")
```

The same test runs with a Playwright `page`.

## Accessibility tree

Empty and filled (generated from the state stories):

<!-- aria:components-textfield--input -->
```yaml
- text: Name
- textbox "Name":
  - /placeholder: Ada Lovelace
```
<!-- /aria -->

<!-- aria:components-textfield--controlled -->
```yaml
- text: Greeting
- textbox "Greeting": Hello
- paragraph: "Value: Hello"
```
<!-- /aria -->

## Tested with

<!-- tested-with:text-field -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
