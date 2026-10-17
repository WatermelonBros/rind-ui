# Switch

An on/off setting that takes effect immediately (APG Switch). The Control is a real `<button role="switch">`; a hidden native `<input type="checkbox">` carries the value, validation and reset ([hidden-form-input](../guides/hidden-form-input.md)).

## When to use

- **Use it for** an on/off setting that takes effect immediately, such as "Airplane mode" or "Wi-Fi".
- **Over a native `<input type="checkbox">`**: it exposes `role="switch"` and `aria-checked`, a thumb and label as styleable parts, `data-state`, and still submits through a hidden checkbox. A plain checkbox is enough when the choice is committed later with a form.
- **Don't use it for** a choice that is saved with a Save button, or that can be mixed: use a [Checkbox](checkbox.md). Don't use it for a button that stays pressed, such as "Bold": use a [Toggle](toggle.md).

```tsx
import { Switch } from "@rind-ui/react"

<Switch.Root name="wifi" onCheckedChange={(checked) => save(checked)}>
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Switch.Label>Wi-Fi</Switch.Label>
  <Switch.Description>Connect to known networks automatically.</Switch.Description>
</Switch.Root>
```

## API

<!-- api:switch -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Switch.Root` | `root` | `<div>`; holds the hidden input as its last child. |
| `Switch.Control` | `control` | `<button role="switch">` (or what `render` gives it). The track. |
| `Switch.Thumb` | `thumb` | `<span aria-hidden>` inside the Control. |
| `Switch.Label` | `label` | `<label for>`; part of the click target ([control-label](../guides/control-label.md)). |
| `Switch.Description` | `description` | `<div>`; in the Control's `aria-describedby`. |

`data-state` is `unchecked` or `checked` on every part; `data-disabled`, `data-readonly`, `data-required` and `data-invalid` mirror the props.

## Keyboard

| Key | Behaviour |
|---|---|
| Space | Toggles. |
| Enter | Does not toggle: inside a form it submits it (implicit submission, as for a native checkbox). |
| Tab | Moves focus. Disabled is skipped unless `focusableWhenDisabled`; read-only stays focusable and ignores activation. |

## Switch, Checkbox or Toggle?

- **Switch**: a setting that applies at once ("Airplane mode"). No indeterminate state.
- **[Checkbox](checkbox.md)**: a choice that is committed later, with a form or a Save button, or that can be mixed.
- **[Toggle](toggle.md)**: a button that stays pressed (a toolbar "Bold"); its name does not describe a setting.

## Accessibility notes

- **Role.** `role="switch"` with `aria-checked="true"`/`"false"`; never `mixed`. The Thumb is `aria-hidden`.
- **Known AT quirks.** Older NVDA and JAWS versions may announce a switch as a "toggle button" or "check box". The state is still conveyed; the [manual protocol](../accessibility/manual-protocol.md) records the current wording.
- **Enter submits.** Switches are not buttons for Enter; use Space (the same choice as a native checkbox).
- **Reset.** A form reset restores the current `defaultChecked` prop.

## Form participation

`name` and `value` (default `"on"`) are submitted while checked; `uncheckedValue` submits that value while unchecked and enabled. `required`, `form` and reset work as for [Checkbox](checkbox.md).

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/switch.css`: structural only (track 2.5rem by 1.5rem, thumb placed with `inset-inline-start` so RTL mirrors by itself, checked = thumb position plus `--rind-switch-checked` fill and border, `--rind-duration-fast` transitions). Forced colors: track border `CanvasText`, checked fill `Highlight` with a `HighlightText` thumb, disabled `GrayText`.

## Testing

Contract actions: `toggle`, `clickLabel`, `resetForm` (clicks a button named "Reset"). Queries: `isChecked`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `name`, `description`, `formValue`.

```tsx
import { getSwitch } from "@rind-ui/testing"

render(<WifiSetting />)
const wifi = getSwitch(screen, { name: "Wi-Fi" })
await wifi.toggle()
await wifi.via("keyboard").toggle()
await wifi.clickLabel()
expect(await wifi.formValue()).toBe("on")
```

The same test runs with a Playwright `page`.

## Accessibility tree

Off and on (generated from the state examples):

<!-- aria:switch--default -->
```yaml
- switch "Wi-Fi"
- text: Wi-Fi
```
<!-- /aria -->

<!-- aria:switch--checked -->
```yaml
- switch "Wi-Fi" [checked]
- text: Wi-Fi
```
<!-- /aria -->

## Tested with

<!-- tested-with:switch -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
