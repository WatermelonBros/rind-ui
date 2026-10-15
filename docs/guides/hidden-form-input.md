# hidden-form-input

The shared behaviour that lets a control that is not a native form field (Checkbox, Switch, Checkbox Group, later Select) take part in forms. Each control renders one visually hidden native input as the last child of its Root, `aria-hidden` and out of the Tab order.

- **Value as properties.** `checked`, `indeterminate` and `value` are written as DOM properties, never the `checked` attribute: that attribute is the default a form reset restores.
- **Events for user changes only.** A user toggle writes the input, then dispatches `input` and `change`; a controlled update or reset dispatches nothing. A synthetic `click` is never used.
- **Reset.** The form's `reset` event sends `RESET`; the control restores its current `defaultChecked` prop. A reset someone prevented is ignored.
- **Validation.** `required` and the Field's custom validity live on the native input, so the form's own `checkValidity()`, `:invalid` and browser messages apply. A re-sync never clears a custom message.
- **Unchecked value.** `uncheckedValue` renders an `<input type="hidden">` with the same `name` while unchecked and enabled.
- **Implicit submission.** Enter on the Control submits its form through the form's default button, as for a native checkbox.
- **Server render.** The input is always rendered, so submission works before hydration.

Used by: [Checkbox](../components/checkbox.md), [Switch](../components/switch.md); Checkbox Group links here.

Caveat: React's synthetic `<form onChange>` does not see these changes; use the component's `onCheckedChange` or a native `change` listener.
