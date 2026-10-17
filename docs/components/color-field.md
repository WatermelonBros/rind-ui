# Color Field

Two text inputs for colours: the **Color Field**, for a whole colour (hex by default, any CSS colour with `format="css"`), and the **Color Channel Field**, a [Number Input](number-input.md) for one channel. Both commit on Enter, on blur, or when their owner asks; never while typing.

```tsx
import { ColorField } from "@rind-ui/react"

<ColorField.Root defaultValue="#FF3D8B" name="brand">
  <ColorField.Label>Brand colour</ColorField.Label>
  <ColorField.Input />
</ColorField.Root>
```

## API

<!-- api:color-field -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `ColorField.Root` | `root` | `<div>` | A Field when not inside one; inside a Field it registers as its control. |
| `ColorField.Label` | `label` | `<label>` | The name. |
| `ColorField.Description` | `description` | `<p>` | Help text. |
| `ColorField.ErrorMessage` | `error-message` | `<p>` | Shown while invalid. |
| `ColorField.Input` | `input` | `<input>` | The `<input type="text">`: the text is free until a commit point. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string \| Color \| null` | — | The colour (controlled). |
| `defaultValue` | `string \| Color \| null` | `null` | The initial colour; a form reset restores it. |
| `onValueChange` | `(color: Color \| null, details) => void` | — | At a commit point (Enter, blur, flush) that changed the colour. |
| `onInputValueChange` | `(text: string) => void` | — | Every accepted edit of the text. |
| `format` | `"hex" \| "css"` | `"hex"` | Hex digits (with an optional `#`), or any CSS colour. |
| `alpha` | `boolean` | `false` | Accept and show 8-digit hex; without it the alpha never changes. |
| `colorSpace` | `"rgb" \| "hsl" \| "hsb"` | — | The space a first colour is emitted in. |
| `name` | `string` | — | Submits `#RRGGBB` (`#RRGGBBAA` with alpha). |
| `required` | `boolean` | `false` | Native constraint. |
| `disabled` | `boolean` | `false` | Disabled. |
| `readOnly` | `boolean` | `false` | Focusable, ignores edits. |
| `messages` | `Partial<ColorFieldMessages>` | — | The invalid message and the colour words. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `input` | `data-scope` | "color-field" |
| `input` | `data-part` | "input" |
| `input` | `data-instance` | The instance id. |
| `input` | `data-disabled` | Present when disabled. |
| `input` | `data-readonly` | Present when read-only. |
| `input` | `data-invalid` | Present while invalid (a draft that is not a colour, or the Field's). |
| `input` | `data-dirty` | Present while the text has an uncommitted edit. |
| `input` | `data-focus` | Present while focused. |
| `input` | `data-focus-visible` | Present while keyboard-focused. |

### Keyboard

| Key | Action |
|---|---|
| Enter | Commits the text. |
| Escape | With an uncommitted edit: restores the colour's text. |

### States

| State | Description |
|---|---|
| `idle` | The text is the colour's. |
| `editing` | An uncommitted edit. |
| `invalid` | A committed text that is not a colour (kept as typed). |

### Contract

| Action | Modalities |
|---|---|
| `type` | keyboard |
| `commit` | keyboard |
| `blur` | keyboard |
| `paste` | keyboard |
| `escape` | keyboard |
| `fill` | keyboard |
| `resetForm` | pointer, keyboard |

Queries: `text`, `color`, `isInvalid`, `isDirty`, `formValue`. Traits: `form-associated`, `field-associated`.
<!-- /api -->

## Typing and commits

While the input has focus the text is free: it is not reformatted, the caret does not move and the value does not change. On Enter or blur the text is parsed leniently — `#` optional, any letter case, 3 or 6 hex digits (4 or 8 with `alpha`) — and a valid colour calls `onValueChange` once and shows as `#RRGGBB`. An empty text commits `null`. A text that is not a colour is kept as typed and marks the field invalid (`aria-invalid`, `data-invalid`, the Field's message) until the next edit. Escape on an uncommitted edit restores the colour's text and is handled, so a popover around the field stays open; the next Escape reaches the popover.

Edits are filtered on the resulting text, in `beforeinput` and again in `input`: a hex field never holds more than its digits, even under a soft keyboard's composition. A 6-digit commit keeps the current alpha; with `alpha` an 8-digit commit sets it; without `alpha` the alpha never changes.

## Forms

The automatic hidden input submits the canonical `#RRGGBB` (`#RRGGBBAA` with alpha), whatever the text looks like. `required` blocks submission and focuses the input. A form reset restores `defaultValue`.

## Color Channel Field

A Number Input whose range, step and format come from the channel: hue in degrees ("120°"), saturation, lightness and brightness in percent ("50%"), alpha as a percentage of 0–1 (typing `50` gives 0.5), red, green and blue as integers. Typed values clamp on commit; an empty commit restores the text (a colour always has every channel). Without a Label it is named by the channel.

```tsx
import { ColorChannelField } from "@rind-ui/react"

<ColorChannelField.Root channel="hue" defaultValue="hsb(200, 50%, 50%)">
  <ColorChannelField.Input />
</ColorChannelField.Root>
```

## Testing

Color Field actions: `type`, `commit`, `blur`, `paste`, `escape`, `fill`, `resetForm`; queries `text`, `color`, `isInvalid`, `isDirty`, `formValue`. `getColorChannelField` is `getNumberInput` with `channel()` and `color()`.

```tsx
import { getColorField } from "@rind-ui/testing"

const fill = getColorField(screen, { name: "Brand colour" })
await fill.fill("3366ff")
expect(await fill.text()).toBe("#3366FF")
```

## Tested with

<!-- tested-with:color-field -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
