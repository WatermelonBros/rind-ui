# Field

Gives one form control a label, a description and an error message, carries `disabled`, `readOnly`, `required` and `invalid` to it, validates it, and exposes the result as data attributes, ARIA and a driver.

```tsx
import { Field, TextField } from "@rind-ui/react"

<Field.Root name="email" required>
  <Field.Label>Email</Field.Label>
  {/* The Text Field's Root joins the enclosing Field (it adds no Field of its own). */}
  <TextField.Root>
    <TextField.Input type="email" />
  </TextField.Root>
  <Field.Description>We never share it.</Field.Description>
  <Field.ErrorMessage />
</Field.Root>
```

One Field wraps **one** control. To group several controls under one name, use a
[Fieldset](fieldset.md).

## API

<!-- api:field -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Field.Root` | `root` | `<div>` | Wraps one form control. No role. |
| `Field.Label` | `label` | `<label>` | Names the control (`for`, or `aria-labelledby` for a group). |
| `Field.Description` | `description` | `<p>` | Help text, first in the control's `aria-describedby`. |
| `Field.ErrorMessage` | `error-message` | `<p>` | Rendered while an error is displayed; `match` picks one validity key. Not a live region. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | — | The control's `name` when it has none; the key of `validate`'s values. |
| `disabled` | `boolean` | `false` | Disables the control; no validity is displayed. |
| `readOnly` | `boolean` | `false` | Makes the control read-only. |
| `required` | `boolean` | `false` | Native `required` (`aria-required` in `aria` behaviour). |
| `invalid` | `boolean` | — | `true` forces invalid, `false` valid; `undefined` validates. |
| `errors` | `string[]` | — | External errors (server): shown at once, cleared by the next change. |
| `validate` | `(value, values) => string \| string[] \| null \| Promise<…>` | — | Runs after native constraints pass. |
| `validationMode` | `"submit" \| "blur" \| "change"` | `"submit"` | When errors are displayed. |
| `validationBehavior` | `"native" \| "aria"` | `"native"` | Whether an invalid Field blocks submission. |
| `validationDebounce` | `number` | `0` | Delays `validate` in `change` mode (ms). |
| `touched` | `boolean` | — | Controlled touched flag. |
| `dirty` | `boolean` | — | Controlled dirty flag. |
| `errorMessageAttribute` | `"describedby" \| "both"` | `"describedby"` | `both` adds `aria-errormessage`. |
| `messages` | `{ errorAnnouncement?, invalid?, valueMissing?, … }` | — | Announcement and per-constraint messages. |
| `match` | `ValidityKey` | — | On ErrorMessage: rendered only when this key is the cause. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "field" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-disabled` | While disabled (own prop or an enclosing Fieldset). |
| `root` | `data-readonly` | While `readOnly`. |
| `root` | `data-required` | While `required`. |
| `root` | `data-valid` | A validation result is displayed and valid (never while disabled). |
| `root` | `data-invalid` | An error is displayed (never while disabled). |
| `root` | `data-validating` | An asynchronous `validate` is running. |
| `root` | `data-touched` | Focus has left the field at least once. |
| `root` | `data-dirty` | The value differs from the first registered value. |
| `root` | `data-filled` | The value is not empty. |
| `root` | `data-name` | The Field's `name` (a Form reads it). |
| `root` | `data-focus` | The control has focus. |
| `root` | `data-focus-visible` | The control has keyboard focus. |
| `label` | `data-scope` | "field" |
| `label` | `data-part` | "label" |
| `label` | `data-instance` | The instance id. |
| `label` | `data-disabled` | While disabled (own prop or an enclosing Fieldset). |
| `label` | `data-readonly` | While `readOnly`. |
| `label` | `data-required` | While `required`. |
| `label` | `data-valid` | A validation result is displayed and valid (never while disabled). |
| `label` | `data-invalid` | An error is displayed (never while disabled). |
| `label` | `data-validating` | An asynchronous `validate` is running. |
| `label` | `data-touched` | Focus has left the field at least once. |
| `label` | `data-dirty` | The value differs from the first registered value. |
| `label` | `data-filled` | The value is not empty. |
| `description` | `data-scope` | "field" |
| `description` | `data-part` | "description" |
| `description` | `data-instance` | The instance id. |
| `description` | `data-disabled` | While disabled (own prop or an enclosing Fieldset). |
| `description` | `data-readonly` | While `readOnly`. |
| `description` | `data-required` | While `required`. |
| `description` | `data-valid` | A validation result is displayed and valid (never while disabled). |
| `description` | `data-invalid` | An error is displayed (never while disabled). |
| `description` | `data-validating` | An asynchronous `validate` is running. |
| `description` | `data-touched` | Focus has left the field at least once. |
| `description` | `data-dirty` | The value differs from the first registered value. |
| `description` | `data-filled` | The value is not empty. |
| `error-message` | `data-scope` | "field" |
| `error-message` | `data-part` | "error-message" |
| `error-message` | `data-instance` | The instance id. |
| `error-message` | `data-disabled` | While disabled (own prop or an enclosing Fieldset). |
| `error-message` | `data-readonly` | While `readOnly`. |
| `error-message` | `data-required` | While `required`. |
| `error-message` | `data-valid` | A validation result is displayed and valid (never while disabled). |
| `error-message` | `data-invalid` | An error is displayed (never while disabled). |
| `error-message` | `data-validating` | An asynchronous `validate` is running. |
| `error-message` | `data-touched` | Focus has left the field at least once. |
| `error-message` | `data-dirty` | The value differs from the first registered value. |
| `error-message` | `data-filled` | The value is not empty. |

### States

| State | Description |
|---|---|
| `idle` | Nothing displayed yet (the mode has not allowed it). |
| `validating` | An asynchronous `validate` is running; the previous display stays. |
| `valid` | A valid result is displayed. |
| `invalid` | An error is displayed. |

### Contract

| Action | Modalities |
|---|---|
| `focus` | pointer, keyboard, virtual |
| `blur` | pointer, keyboard, virtual |
| `type` | keyboard |

Queries: `isValid`, `isInvalid`, `isValidating`, `isTouched`, `isDirty`, `isFilled`, `isRequired`, `isDisabled`, `isReadOnly`, `errors`, `description`, `label`, `controlName`, `controlDescription`. Traits: none.
<!-- /api -->

## Validation model

**Sources**, the first that reports an error wins:

1. the `invalid` prop (`true` forces invalid, `false` forces valid);
2. external errors (`errors`, from Form or your server);
3. the control's native constraints (`required`, `type`, `pattern`, `minLength`, …);
4. your `validate(value, values)`, run only when native constraints pass. It may return a
   string, several strings, or a promise of them.

The current error is always written to the control's native validity
(`setCustomValidity`), so `form.checkValidity()`, `:invalid` and submission agree with what
the Field shows.

**When it is shown** (`validationMode`):

- `"submit"` (default): nothing until the first submit attempt, then on every change;
- `"blur"`: when focus leaves after a change, then on every change;
- `"change"`: on every change.

A missing value is never shown while the user is only tabbing through (until it changed
once or the form was submitted). A fixed value clears the error with the keystroke that
fixes it.

**Whether it blocks submission** (`validationBehavior`): `"native"` (default) blocks an
invalid form; `"aria"` sets `aria-required` instead of `required` and never blocks.

**Asynchronous `validate`**: the Field shows `data-validating`, keeps the current display
until the promise settles, and drops results of older checks.
`validationDebounce` delays `validate` while typing in `change` mode.

## Accessibility

- The control's `aria-describedby` lists the Description, then the ErrorMessage while it
  is rendered, then the control's own ids: never a missing id, never an empty string. The
  error is never part of the name. `aria-errormessage` is added only with
  `errorMessageAttribute="both"`.
- A failed submission focuses the **first invalid control in the form's order**, with a
  visible focus ring.
- An error that appears while the user is elsewhere is **announced** once, politely
  ("Email: Enter a valid email"); never twice for the same message, never when a failed
  submission moved focus to the control (focus already reads it), never while composing.
- Without an ErrorMessage part, the browser's own validation bubble is shown, so an error
  is never silent.

## Implementing a control

See [Implementing field-control](../guides/field-control.md).

## Testing

```tsx
import { getField } from "@rind-ui/testing"

const email = getField(screen, { label: "Email" })
await userEvent.type(screen.getByLabelText("Email"), "a@")
await userEvent.click(screen.getByRole("button", { name: "Send" }))
expect(await email.isInvalid()).toBe(true)
expect(await email.errors()).toEqual(["Please enter an email address."])
```

`getField(...).control(getTextField)` returns the control's own driver, located by the
name the Field's Label gives it.

## Accessibility tree

Idle, valid and invalid (generated from the state examples):

<!-- aria:field--idle -->
```yaml
- text: Email
- textbox "Email"
- paragraph: We never share it.
```
<!-- /aria -->

<!-- aria:field--valid -->
```yaml
- text: Email
- textbox "Email": ada@example.com
- paragraph: We never share it.
```
<!-- /aria -->

<!-- aria:field--invalid -->
```yaml
- text: Email
- textbox "Email" [invalid]: abc
- paragraph: We never share it.
- paragraph: Enter a valid email address.
```
<!-- /aria -->

## Tested with

<!-- tested-with:field -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
