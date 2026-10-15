# Checkbox

A checked, unchecked or mixed (`indeterminate`) choice that is submitted with a form. The Control is a real `<button role="checkbox">`; a hidden native `<input type="checkbox">` carries the value, validation and reset ([hidden-form-input](../guides/hidden-form-input.md)).

```tsx
import { Checkbox } from "@rind-ui/react"

<Checkbox.Root name="terms" required onCheckedChange={(checked) => save(checked)}>
  <Checkbox.Control>
    <Checkbox.Indicator>
      {({ indeterminate }) => (indeterminate ? <DashIcon /> : <CheckIcon />)}
    </Checkbox.Indicator>
  </Checkbox.Control>
  <Checkbox.Label>Accept the terms</Checkbox.Label>
  <Checkbox.Description>You can withdraw at any time.</Checkbox.Description>
</Checkbox.Root>
```

## API

<!-- api:checkbox -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Checkbox.Root` | `root` | `<div>`; holds the hidden input as its last child. |
| `Checkbox.Control` | `control` | `<button role="checkbox">` (or what `render` gives it). |
| `Checkbox.Indicator` | `indicator` | `<span aria-hidden>`; children may be a function of `{ checked, indeterminate }`. |
| `Checkbox.Label` | `label` | `<label for>`; part of the click target ([control-label](../guides/control-label.md)). |
| `Checkbox.Description` | `description` | `<div>`; in the Control's `aria-describedby`. |

`data-state` is `unchecked`, `checked` or `indeterminate` on every part; `data-disabled`, `data-readonly`, `data-required` and `data-invalid` mirror the props.

## Keyboard

- **Space** toggles. An indeterminate Checkbox becomes checked.
- **Enter** does not toggle: inside a form it submits it (implicit submission, as for a native checkbox).
- Disabled does nothing; with `focusableWhenDisabled` it stays in the Tab order. Read-only is focusable and ignores activation.

## Accessibility notes

- **Label wiring.** A labelable Control is named by `<label for>`, so a consumer `aria-label` is never doubled. A Control rendered as a `<div>` (`render={<div />}`) is named by `aria-labelledby` and its Label toggles it once. Wrapping the Root in your own `<label>` also works.
- **Mixed.** `aria-checked="mixed"` is exposed for `indeterminate`. The glyph is yours: draw a different shape for the dash, the theme never relies on colour alone.
- **Enter submits.** A checkbox is not a button; Enter belongs to the form.
- **`<form onChange>` caveat.** React's synthetic `onChange` on a `<form>` does not see changes of the Checkbox (they come from the hidden input, written by the component). Use `onCheckedChange`, or a native `change` listener on the form element.
- **Reset.** A form reset restores the current `defaultChecked` prop. Changing that prop never changes the current value.

## Form participation

`name` and `value` (default `"on"`) are submitted while checked; `uncheckedValue` submits that value while unchecked and enabled. `required` makes the form invalid until checked, with the browser's own message. `form` associates it with a form elsewhere in the document. See [hidden-form-input](../guides/hidden-form-input.md).

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/checkbox.css`: structural only (box with border, glyph in `currentColor` hidden with `visibility` while unchecked, filled box when checked or mixed, a hit area of `--rind-hit-area` with the Label as part of the target, duration tokens). Forced colors map checked and mixed to `Highlight`/`HighlightText`, disabled to `GrayText`, the border to `CanvasText`.

## Testing

Contract actions: `toggle`, `check`, `uncheck`, `clickLabel`, `resetForm` (clicks a button named "Reset"). Queries: `checkedState`, `isChecked`, `isIndeterminate`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `name`, `description`, `formValue`.

```tsx
import { getCheckbox } from "@rind-ui/testing"

render(<Terms />)
const terms = getCheckbox(screen, { name: "Accept the terms" })
await terms.check()
await terms.via("keyboard").uncheck()
await terms.clickLabel()
expect(await terms.formValue()).toBe("on")
```

The same test runs with a Playwright `page`.

## Accessibility tree

Unchecked, checked and mixed (generated from the state stories):

<!-- aria:components-checkbox--default -->
```yaml
- checkbox "Accept the terms"
- text: Accept the terms
```
<!-- /aria -->

<!-- aria:components-checkbox--checked -->
```yaml
- checkbox "Accept the terms" [checked]
- text: Accept the terms
```
<!-- /aria -->

<!-- aria:components-checkbox--indeterminate -->
```yaml
- checkbox "Select all" [checked=mixed]
- text: Select all
```
<!-- /aria -->

## Tested with

<!-- tested-with:checkbox -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
