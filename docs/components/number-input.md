# Number Input

A text field for numbers with an optional stepper on each side. It formats and parses in the user's locale (decimal, percent, currency, unit; Latin, Arabic, Persian, Devanagari and full-width digits), steps by keyboard, buttons, press-and-hold and wheel, and submits a real number through a hidden native `<input type="number">`. The Root is a Field, so labelling, description and validation work like any Field.

```tsx
import { NumberInput } from "@rind-ui/react"

<NumberInput.Root name="quantity" min={1} max={99} defaultValue={2}>
  <NumberInput.Label>Quantity</NumberInput.Label>
  <NumberInput.Control>
    <NumberInput.DecrementTrigger>−</NumberInput.DecrementTrigger>
    <NumberInput.Input />
    <NumberInput.IncrementTrigger>+</NumberInput.IncrementTrigger>
  </NumberInput.Control>
  <NumberInput.Description>Per order.</NumberInput.Description>
  <NumberInput.ErrorMessage />
</NumberInput.Root>
```

Triggers are optional. Parsing and formatting come from the shared [number-parsing](../guides/number-parsing.md) capability.

## API

<!-- api:number-input -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `NumberInput.Root` | `root` | `<div>`; a Field when not inside one. Also renders the hidden number input (`data-part="hidden-input"`). |
| `NumberInput.Label` / `Description` / `ErrorMessage` | `label` / `description` / `error-message` | The Field's parts. |
| `NumberInput.Control` | `control` | `<div>` around the input and triggers. |
| `NumberInput.Input` | `input` | `<input type="text" role="spinbutton">`. |
| `NumberInput.IncrementTrigger` / `DecrementTrigger` | `increment-trigger` / `decrement-trigger` | `<button>`, out of the Tab order. |

## Value and commit model

- **Typing never changes the value.** Each accepted edit updates the text (`onInputValueChange`); the value changes at commit points only: blur, Enter, a key step, a stepper, the wheel, a paste over the whole text, a spin repeat, a form reset.
- `onValueChange(value, { reason, cancel })` runs for every applied change; `cancel()` refuses it. Reasons: `INPUT.COMMIT`, `STEP`, `EDGE`, `WHEEL`, `PASTE`, `SPIN`, `RESET`.
- `onValueCommit(value, { reason })` runs **once per interaction** that changed the value: a key press, a stepper release (not each repeat), a wheel tick, a blur or Enter commit. Save to a server here.
- `onInputValueChange(text)` runs for every accepted edit of the text.
- `commitBehavior="snap"` (default) clamps to `min` / `max` and snaps at commit; `"validate"` keeps the typed number, so the hidden input's constraints and the Field report it.
- Commit snapping uses an **explicit** `step` only. The default step of 1 (0.01 for percent) drives the keys and steppers but does not reject or round a typed 1.5.
- A controlled `value` is a proposal: if the parent keeps a different value, the text returns to it.

## Locale and numbering systems

`formatOptions` (`Intl.NumberFormatOptions`) and `locale` (default: the provider's) set the display and what is accepted. Digits of the Arabic-Indic, Persian, Devanagari, Bengali, Han decimal and full-width numbering systems are accepted in any locale, and the system the user typed is kept while the field shows that value. Percent values are fractions (0.25 shows as 25%). A touch keypad that inserts `.` or the device's separator is mapped to the field's decimal separator (the keypad decimal quirk). The input shows `inputmode="decimal"` or `"numeric"` from the options, `min` and `step`.

## Keyboard

| Key | Behaviour |
|---|---|
| Arrow Up / Down | Increase / decrease by `step`. |
| Shift + Arrow Up / Down | Moves by `largeStep` (10 × `step`). |
| Page Up / Page Down | Moves by `largeStep`. |
| Home / End | Jump to `min` / `max`, only when that bound is set. |
| Enter | Commits the text, then the form submits (implicit submission) with the new value. |
| Alt / Ctrl / Meta + key | Ignored. |

## Steppers and press-and-hold

A stepper steps on press. With `spinOnPress` (default) holding it repeats: after `spinDelay` (400 ms) every `spinInterval` (60 ms). Touch steps on release and starts repeating after 600 ms; a touch that repeated does not step again on release. Repeats stop when the pointer leaves, the press cancels, the value reaches the bound, or the field becomes disabled or read-only. Triggers never take focus (a pointer press moves focus to the input), and at a bound they set `aria-disabled="true"` instead of a native `disabled`, so a hold is not dropped mid-press. A draft being typed commits when a stepper is pressed.

## Wheel

`allowWheel` steps the **focused** input on a vertical wheel (Shift: `largeStep`). Horizontal scrolls and Ctrl + wheel (zoom) are ignored, and an unfocused input never steals page scroll.

## Accessibility notes

- **Role.** The input is a `spinbutton` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax` (when set). `aria-valuetext` comes from `messages.valueText` over the formatted text (true minus sign U+2212); an empty field reads "Empty" (`messages.empty`).
- **Triggers** are named "Increase" / "Decrease" followed by the Label's text (`messages.increment`, `messages.decrement`).
- **Announcements** only for what a screen reader would not otherwise hear: a touch or assistive-technology stepper press, and a commit that rewrote the typed text (`messages.committed`). Keyboard steps are read from the changed `aria-valuetext`.
- **iOS VoiceOver** mishandles a text-input spinbutton; there the input is a plain textbox (no role or value attributes) and the contract locates it with `role: "textbox"`.
- The Label names the input; the triggers keep `tabindex="-1"` because the keys do the same job.

## Form submission

The hidden `<input type="number">` carries `name`, `form`, `min`, `max`, `step` (`any` without a `min`), `required` and the custom validity. It submits the **raw number** (`1234.5`, not "1.234,50 €"), nothing when empty. A form reset restores the **current** `defaultValue` prop. Autofill or an extension that writes to the hidden input is adopted as a commit.

## Field integration

The Root is a Field when alone and joins the enclosing Field or [Fieldset](fieldset.md) otherwise: `disabled`, `required`, `invalid`, `errors`, `validate`, `validationMode` and `fieldMessages` work as on [Text Field](text-field.md). Each applied change is reported to the Field once; Enter reports a commit.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/number-input.css`: structural defaults for the Control, Input and triggers, with `data-pressed`, `data-spinning` and `aria-disabled` states and forced-colors support.

## Testing

Contract actions: `type`, `fill`, `commit`, `step`, `pageStep`, `toEdge`, `pressStepper`, `releaseStepper`, `cancelStepper`, `holdStepper`, `wheel`, `paste`, `composeOpen`, `composeEnd`, `resetForm`. Queries: `value`, `text`, `valueText`, `formValue`, `canIncrement`, `canDecrement`, `isInvalid`, `isDisabled`, `isReadOnly`, `isSpinning`, `isComposing`.

```tsx
import { getNumberInput } from "@rind-ui/testing"

render(<QuantityField />)
const quantity = getNumberInput(screen, { name: "Quantity" })
await quantity.step("increase")
expect(await quantity.value()).toBe(3)
await quantity.fill("42") // types, then Tabs away to commit
expect(await quantity.valueText()).toBe("42")
await quantity.holdStepper("increase", 580) // pointer holds need layout (a real browser)
```

Keyboard actions work in jsdom (`quantity.via("keyboard").step("increase")`); pointer steps and holds need a layout engine. Under the iOS quirk locate it with `{ name, role: "textbox" }`.

## Tested with

<!-- tested-with:number-input -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
