# Labels

Every rind-ui label follows the same rules, whether it is the standalone [Label](../components/label.md), a control's own Label part (Checkbox, Switch) or a Field's Label. The browser's native `<label>` does the naming and the activation; rind-ui only adds what native labels get wrong.

## What a label does

- **`for` or wrapping.** A label names a *labelable* element (`input`, `select`,
  `textarea`, `button`, `meter`, `output`, `progress`) through `for`, or by wrapping it.
  This works before hydration and without JavaScript.
- **No role, no ARIA.** The `<label>` element is enough; rind-ui never adds `role` to it.
- **Double click selects nothing.** A double click on the label's own text would select
  it; rind-ui cancels only that `mousedown` (`detail > 1`). A press that starts on an input
  inside the label keeps word selection and number steppers; a single click still moves
  focus. Your own `onMouseDown` runs first, and `preventDefault()` or
  `preventRindHandler()` there opts out.
- **Clicks pass through.** A link inside a label navigates without toggling the checkbox,
  and a descendant's `preventDefault()` stops the activation, as natively.

## Targets a label cannot name

A `div` with `role="radiogroup"` or `role="combobox"` is not labelable: `for` would do
nothing. rind-ui then renders the label **without `for`**, and a click on the label
**focuses** the target (it never activates it). The target is named by its own
`aria-labelledby` pointing at the label's `id`; rind-ui controls set that themselves.

In development, a label whose `for` names no element, or a non-labelable one, warns once
and says how to fix it: use the control's own Label part, a Field, or `aria-labelledby`.

## Labels focus popup triggers

A label never opens a popup. Clicking the label of a Select, Combobox, Menu or Date Picker
trigger focuses the trigger and leaves it closed, as a native `<label>` does for a
`<select>`. This works for a rind-ui label, a `<label for>` of yours and a wrapping
`<label>`: those triggers declare `labelActivation: "focus"` in their press options.

## Required fields

Put the required marker inside the label but hide it from assistive technology, and mark
the control itself as required:

```tsx
<Label htmlFor="email">
  Email <span aria-hidden="true">*</span>
</Label>
<input id="email" required />
```
