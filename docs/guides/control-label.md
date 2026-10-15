# control-label

The shared Label and Description of a labelable control (Checkbox, Switch, group items).

- **Names the control.** A native-labelable Control (`<button>`, `<input>`) is named by `<label for>`; no `aria-labelledby` is added, so a consumer `aria-label` is never doubled. A non-labelable Control (a `<div>` through `render`) is named by `aria-labelledby`, and its Label focuses and presses it instead.
- **One activation per click.** A click on the Label toggles the control once, as a pointer press. No `click` is cancelled; a double click does not select text away from the control (only `detail > 1` is guarded).
- **Description.** In the Control's `aria-describedby`, together with a Field's Description and ErrorMessage and the consumer's own ids.
- **State mirrored.** Label and Description carry the Control's `data-state`, `data-disabled`, `data-readonly`, `data-required` and `data-invalid`.
- **Inside a Field.** The Field's Label names the control; an own Label there logs a development warning.

Used by: [Checkbox](../components/checkbox.md), [Switch](../components/switch.md), [Checkbox Group](../components/checkbox-group.md) (its items). The pointer rules are those of [Label](../components/label.md).
