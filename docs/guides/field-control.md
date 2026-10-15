# Implementing field-control

How a form control works inside a Field. Every rind-ui form control (Text Field, Checkbox, Select, …) does this, and your own control can too: the Field then labels, describes, validates and disables it like a built-in one.

## 1. Read the binding

```tsx
import { useFieldControl } from "@rind-ui/react"
import { mergeFieldProps } from "@rind-ui/core"

const binding = useFieldControl() // null outside a Field
const id = props.id ?? binding?.controlId ?? generatedId
const field = mergeFieldProps(
  { role: "textbox", labelable: true, disabled, readOnly, required, invalid, name,
    consumerDescribedBy: props["aria-describedby"] },
  binding,
)
```

`mergeFieldProps` ORs the booleans, builds `aria-describedby` (Field description, the
error while it is shown, your own ids, the consumer's), adds `aria-labelledby` only for a
non-labelable control, sets `aria-invalid` except on role `button`, and turns `required`
into `aria-required` in `aria` behaviour. Apply the result to your focusable element, and
spread `binding.data` (the validation data attributes) on your root part.

Use `binding.controlId` as your element's id when you have none: the Field's Label already
points at it in the server HTML.

## 2. Register once

```tsx
useLayoutEffect(() => binding?.register({
  id,
  labelable: true,                         // false for a group: named by aria-labelledby
  focus: (modality) => focusSafely(el.current, env, "programmatic", modality),
  validityElement: () => el.current,       // the native input, or your hidden input
  value: () => currentValue(),
}, labelText), [binding?.register, id])
```

A group (Checkbox Group, Radio Group) registers as one control, and its items do not
register. A popup's own search input never reads the binding. `focus` moves to what the
user would fix: in a group, the first invalid item or the tab stop.

## 3. Report changes, never decide timing

```tsx
binding?.report({ type: "change", value, user: true, composing })  // each accepted change
binding?.report({ type: "commit" })                                // Enter, a Select closing
```

Report each change you accepted, once; never a change you refused (disabled, read-only,
a controlled parent saying no). A controlled value changed by the parent is reported with
`user: false`. The Field decides when to validate and display.

## 4. Declare the trait

Your contract declares the `field-associated` trait, so the model-based tests check, inside
a Field, that the control is named by the Label, described by exactly the rendered parts,
`aria-invalid` exactly when the Field displays invalid, and disabled, read-only and
required as the Field says.
