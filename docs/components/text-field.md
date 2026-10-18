# Text Field

A native `<input>` or `<textarea>` with a controllable value, correct IME handling, a clear button, a character count and autosize, labelled, described and validated like any Field. `type="password"` adds a visibility toggle every input method can operate; `type="search"` adds search semantics, Escape to clear and Enter to search.

## When to use

- **Use it for** text input in a form: names, emails, comments (plain), secrets (`type="password"`) and queries (`type="search"`).
- **Over a bare `<input>` or `<textarea>`**: it is still the native element, and adds a label, description and error message wired through Field, a controllable value with correct IME handling, a clear button, a character count, autosize for the textarea, and `data-*` state attributes. With `type="password"` it also adds a toggle that keeps one name, keeps the caret and hides the password again on submit and reset; with `type="search"` it adds the `searchbox` role, Escape to clear and `onSubmit` on Enter, without stealing Escape from an enclosing Dialog. A bare `<input>` is enough when you need none of that.
- **Don't use it for** a specialised input that has its own component: [Number Input](number-input.md) or [Pin Input](pin-input.md). For a choice from a fixed list, or suggestions as the user types, use a [Select](select.md) or a combobox.

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
| `TextField.VisibilityTrigger` | `visibility-trigger` | `<button>` | With `type="password"`: a toggle button in the Tab order, `aria-pressed`, one name in both states ("Show password"). |
| `TextField.VisibilityIndicator` | `visibility-indicator` | `<span>` | An `aria-hidden` icon slot that follows `data-state`. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | `"text"` | The Input's native type. `"password"`: the visibility parts and rules; `"search"`: a searchbox, "Clear search", Escape clears. |
| `visible` | `boolean` | — | Controlled visibility (`type="password"`). |
| `defaultVisible` | `boolean` | `false` | Uncontrolled visibility. |
| `onVisibleChange` | `(visible, { reason }) => void` | — | Reasons `PRESS`, `SUBMIT` (any form submit) and `RESET` (an unprevented reset). |
| `escapeClears` | `boolean` | `true with `type="search"`, else false` | Escape clears a non-empty editable value (reason `ESCAPE`) and is consumed only then. |
| `onSubmit` | `(value, { event }) => void` | — | Enter, never while composing; the form still submits unless `event.preventDefault()`. |
| `value` | `string \| null` | — | Controlled value (`null` renders empty). |
| `defaultValue` | `string` | — | Uncontrolled: the DOM owns the value. |
| `onValueChange` | `(value, { reason, event, isComposing }) => void` | — | Every change, with its reason (`INPUT`, `CLEAR`, `ESCAPE`, `RESET`). Native `onChange` is forwarded untouched. |
| `focusableWhenDisabled` | `boolean` | `false` | Disabled but focusable: read-only + `aria-disabled`. |
| `countThreshold` | `number` | — | Announce the count at this many remaining (default max(10, 20% of the limit)). |
| `messages` | `{ clear?, clearSearch?, charactersRemaining?, charactersOver?, toggleLabel?, visibilityAnnouncement? }` | — | The ClearTrigger name (also for search), count announcements, the VisibilityTrigger's name and the shown/hidden announcement. |
| `fieldMessages` | `Field messages` | — | The Field's messages when the Root is the Field. |
| `autosize` | `boolean` | `false` | On Textarea: grows with its content (native `field-sizing` where supported). |
| `max` | `number` | — | On CharacterCount: a soft limit (an error past it, never a truncation). |
| `count` | `(value) => number` | — | On CharacterCount: replaces the counter. |
| `children` | `ReactNode` | — | The parts: Label, Input or Textarea, Description, ErrorMessage and the triggers. |
| `name` | `string` | — | The control's `name` when it has none; the key of `validate`'s values. |
| `disabled` | `boolean` | — | Disables the control; no validity is displayed. Also inherited from an enclosing Field. |
| `readOnly` | `boolean` | — | Makes the control read-only. Also inherited from an enclosing Field. |
| `required` | `boolean` | — | Native `required` (`aria-required` in `aria` behaviour). |
| `invalid` | `boolean` | — | `true` forces invalid, `false` valid; `undefined` validates. |
| `errors` | `readonly string[]` | — | External errors (server): shown at once, cleared by the next change. |
| `validate` | `Validate` | — | Runs after native constraints pass. |
| `validationMode` | `ValidationMode` | — | When errors are displayed. Default: `"submit"`. |
| `validationBehavior` | `ValidationBehavior` | — | Whether an invalid Field blocks submission. Default: `"native"`. |
| `validationDebounce` | `number` | — | Delays `validate` in `change` mode (ms). Default: 0. |
| `render` | `RenderProp<FieldState>` | — | Another element or a render function receiving the props and the Field's state. |
| `match` | `string` | — | Rendered only when this validity key caused the error (one message per constraint). |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "text-field" |
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
| `root` | `data-empty` | The value is empty. |
| `root` | `data-state` | `type="password"`: "visible" or "hidden". |
| `input` | `data-scope` | "text-field" |
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
| `input` | `data-empty` | The value is empty. |
| `input` | `data-state` | `type="password"`: "visible" or "hidden". |
| `input` | `data-custom-reveal` | A VisibilityTrigger is mounted (Edge's `::-ms-reveal` is hidden). |
| `input` | `data-custom-clear` | `type="search"` with a ClearTrigger mounted (the native cancel button is hidden). |
| `visibility-trigger` | `data-scope` | "text-field" |
| `visibility-trigger` | `data-part` | "visibility-trigger" |
| `visibility-trigger` | `data-instance` | The instance id. |
| `visibility-trigger` | `data-disabled` | While disabled. |
| `visibility-trigger` | `data-state` | "visible" or "hidden". |
| `visibility-trigger` | `data-pressed` | A press is in progress. |
| `visibility-trigger` | `data-focus-visible` | Keyboard focus. |
| `visibility-indicator` | `data-scope` | "text-field" |
| `visibility-indicator` | `data-part` | "visibility-indicator" |
| `visibility-indicator` | `data-instance` | The instance id. |
| `visibility-indicator` | `data-disabled` | While disabled. |
| `visibility-indicator` | `data-readonly` | While read-only. |
| `visibility-indicator` | `data-required` | While required. |
| `visibility-indicator` | `data-valid` | A valid result is displayed (Field). |
| `visibility-indicator` | `data-invalid` | An error is displayed (Field). |
| `visibility-indicator` | `data-validating` | An async check is running (Field). |
| `visibility-indicator` | `data-touched` | Focus has left it once (Field). |
| `visibility-indicator` | `data-dirty` | The value differs from the first one (Field). |
| `visibility-indicator` | `data-filled` | The value is not empty (Field). |
| `visibility-indicator` | `data-state` | "visible" or "hidden". |
| `character-count` | `data-scope` | "text-field" |
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
| Enter | In an Input: commits the value (Field) and calls `onSubmit`, unless an IME is composing; the form submits natively. |
| Escape | With `escapeClears` and a non-empty editable value: clears it (consumed only then). |
| Space / Enter | On the VisibilityTrigger: toggles visibility (focus stays on it). |
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
| `escape` | keyboard |
| `submit` | keyboard |
| `toggleVisibility` | pointer, keyboard, touch, virtual |
| `submitForm` | pointer, keyboard, virtual |

Queries: `value`, `name`, `description`, `isInvalid`, `isDisabled`, `isReadOnly`, `isRequired`, `errors`, `characterCount`, `isClearable`, `isComposing`, `isEmpty`, `isVisible`, `inputType`, `toggleName`. Traits: `field-associated`.
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

## Password

`type="password"` on the Root adds the visibility parts and rules. Place a `VisibilityTrigger` (with an optional `VisibilityIndicator` icon slot) beside the Input:

```tsx
<TextField.Root type="password" name="password">
  <TextField.Label>Password</TextField.Label>
  <TextField.Input />
  <TextField.VisibilityTrigger>
    <TextField.VisibilityIndicator />
  </TextField.VisibilityTrigger>
  <TextField.ErrorMessage />
</TextField.Root>
```

- **Visibility.** `visible` / `defaultVisible` / `onVisibleChange(visible, { reason })` control it; the reasons are `PRESS`, `SUBMIT` and `RESET`. A disabled field cannot be toggled; a read-only one can. Style the icon from the `data-state` (`visible` or `hidden`), carried by Root, Input, trigger and indicator.
- **Hidden on submit and reset.** The form's `submit` event hides the password, prevented or not, so the input is `type="password"` before the browser builds the form data and a password manager never stores the clear text. A `reset` hides it unless a listener prevents it. A controlled `visible` receives a proposal (`false`); the parent decides.
- **Trigger semantics.** The trigger is a toggle button: `aria-pressed` holds the state and its name is always "Show password" (`messages.toggleLabel`). Changing the label with the state as well makes a screen reader say it twice. It stays in the Tab order, so a keyboard user can reveal the text.
- **Caret and focus.** A mouse or pen press keeps focus and the caret in the input, and the selection is restored after the `type` change. A touch press moves no focus. When focus stays in the input, a polite "Password shown" / "Password hidden" is announced; the password itself never is.
- **Autocomplete.** `autoComplete` defaults to `current-password`. Use `new-password` on sign-up and reset forms so a password manager offers to generate one; any value passes through, as do `name`, `minLength`, `maxLength`, `pattern` and `passwordrules`.
- **Privacy.** `spellcheck="false"`, `autocorrect="off"` and `autocapitalize="none"` hold in both states, so revealed text never reaches a spellcheck service. The browser's own reveal control is hidden while a trigger is mounted (`data-custom-reveal` on the Input).
- **Password managers.** They draw a badge at the inline end of the input. Reserve space for it and for the trigger with padding on the input, and do not let the trigger cover it.
- **Accessibility.** A password input has no ARIA role, so the Label names it and the contract locates it by its exact name. Field state (`disabled`, `invalid`, `required`) reaches the input; `disabled` also reaches the trigger.

## Search

`type="search"` on the Root makes the Input a `searchbox` with `enterKeyHint="search"`, names the ClearTrigger "Clear search" (`messages.clearSearch`) and turns `escapeClears` on:

```tsx
<TextField.Root type="search" name="q" onSubmit={(value) => search(value)}>
  <TextField.Label>Search books</TextField.Label>
  <TextField.Input />
  <TextField.ClearTrigger />
</TextField.Root>
```

Icon-only: omit the Label and set `aria-label` on the Input.

- **Escape.** With `escapeClears` (on by default for search, available on any field) Escape clears a non-empty, editable value (`onValueChange("", { reason: "ESCAPE" })`), keeps focus in the input and consumes the key. On an empty, disabled or read-only field Escape is not handled, so an enclosing Dialog closes.
- **Enter.** `onSubmit(value, { event })` runs once on Enter, for every `type`. The form still submits; call `event.preventDefault()` to stop it.
- **IME.** A composition owns both keys. Escape cancels the composition and Enter commits the text; neither clears nor searches.
- **Native cancel button.** The browser draws its own cancel button on `type="search"`. It is hidden only while a ClearTrigger is mounted (`data-custom-clear` on the Input), so there is one clear control; without a ClearTrigger the browser's button stays. The ClearTrigger shows only when there is text, stays out of the Tab order (Escape is its keyboard twin) and clearing re-validates the Field.
- **Landmark.** Wrap the form in the native `<search>` element so the page has a search landmark.
- **Debouncing.** There is no built-in debounce. Debounce in your own `onValueChange`, and search at once from `onSubmit`.
- **No suggestions.** There is no popup or result list. When the user picks from suggestions, use a combobox.

## Testing

```tsx
import { getTextField } from "@rind-ui/testing"

const email = getTextField(screen, { name: "Email" })
await email.fill("a@b.co")
expect(await email.value()).toBe("a@b.co")
await email.compose("てすと", "テスト")

// type="password"
const password = getTextField(screen, { name: "Password" })
await password.toggleVisibility()
expect(await password.inputType()).toBe("text")
expect(await password.toggleName()).toBe("Show password")
await password.submitForm()
expect(await password.isVisible()).toBe(false)

// type="search"
const search = getTextField(screen, { name: "Search books" })
await search.via("keyboard").escape() // clears
await search.type("dune")
await search.submit() // presses Enter
```

The same test runs with a Playwright `page`.

## Styling

Style the `data-*` attributes above (`data-empty` on Root and Input, `data-state` for the password visibility, `data-custom-reveal` / `data-custom-clear` on the Input). The theme package ships `@rind-ui/theme/text-field.css`, which also covers the password and search options.

## Accessibility tree

Empty and filled (generated from the state examples):

<!-- aria:text-field--input -->
```yaml
- text: Name
- textbox "Name":
  - /placeholder: Ada Lovelace
```
<!-- /aria -->

<!-- aria:text-field--controlled-story -->
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
