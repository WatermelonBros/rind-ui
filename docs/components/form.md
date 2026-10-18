# Form

A native `<form>` that validates every Field it contains on a submit attempt, focuses the first invalid one, holds a submission for pending async checks, maps server errors to Fields by name, announces a failed attempt once, and resets with rules that survive React form actions.

## When to use

- **Use it for** a form with several Fields that should validate together on submit, focus the first invalid one, show server errors by Field name and announce a failed attempt.
- **Over a plain `<form>`**: it adds whole-form validation, holding a submission for pending async checks, typed values in `onFormSubmit`, and reset rules that survive React form actions.
- **Don't use it for** a single control: a [Field](field.md) works in a plain `<form>` too. If native validation and a normal submit are enough, use the native `<form>`.

```tsx
import { Field, Form, TextField } from "@rind-ui/react"

<Form.Root aria-label="Sign up" onFormSubmit={(values) => save(values)}>
  <Field.Root name="email" required>
    <Field.Label>Email</Field.Label>
    <TextField.Root>
      <TextField.Input type="email" />
    </TextField.Root>
    <Field.ErrorMessage />
  </Field.Root>
  <button type="submit">Sign up</button>
</Form.Root>
```

A [Field](field.md) works in a plain `<form>` too; Form adds what needs the whole form.

## API

<!-- api:form -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Form.Root` | `root` | `<form>` | A native `<form>`; `novalidate` only in `aria` behaviour. |

### Props

| Part | Prop | Type | Default | Description |
|---|---|---|---|---|
| `Form.Root` | `validationMode` | `"submit" \| "blur" \| "change"` | — | Default mode for the Fields inside. |
| `Form.Root` | `validationBehavior` | `"native" \| "aria"` | — | Default behaviour for the Fields inside; `aria` adds `novalidate`. |
| `Form.Root` | `errors` | `Record<string, string \| string[]>` | — | Server errors by exact Field name; shown at once, cleared by that Field's next change. |
| `Form.Root` | `onFormSubmit` | `(values, { event, submitter }) => void` | — | Replaces the native submission with the typed values of every named Field. |
| `Form.Root` | `actionsRef` | `Ref<{ validate(name?): void }>` | — | The imperative `validate`: displays errors, focuses nothing. |
| `Form.Root` | `messages` | `{ invalidSummary?: (count) => string }` | — | The failed-attempt summary. |
| `Form.Root` | `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element. |
| `Form.Root` | `children` | `ReactNode` | — | The form's content (its Fields and controls). |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "form" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-validating` | A submission is held for pending async checks. |
| `root` | `data-invalid` | The last attempt failed (until the next attempt or reset). |

### States

| State | Description |
|---|---|
| `idle` | Ready; also after a failed attempt. |
| `validating` | A submission is held until every async check settles. |
| `awaiting-server` | A submission proceeded; server errors may come back through `errors`. |

### Contract

| Action | Modalities |
|---|---|
| `submit` | pointer, keyboard, virtual |
| `reset` | pointer, keyboard, virtual |
| `validate` | pointer, virtual |

Queries: `isInvalid`, `isValidating`, `invalidFields`, `focusedField`, `submissions`. Traits: none.
<!-- /api -->

## Submission sequence

1. A submit attempt (a submit button, Enter in a field, `requestSubmit()`, or
   `validate()`) validates **every** Field, and each displays its result.
2. If any Field is invalid, the submission is cancelled and focus moves **once** to the
   first invalid Field in the form's order, with a focus ring. Nothing moves focus later
   unless a new attempt (or new server errors) asks for it.
3. If a Field is still checking (an async `validate`), the submission is held
   (`data-validating`) and requested again, with the same submit button, once every check
   settled valid.
4. Otherwise it proceeds: natively, or through `onFormSubmit(values)` with the typed value
   of every named Field.

## Server errors

Pass the errors your server returned as `errors`, keyed by Field `name` (exact names:
`items.0.name` is matched as a string). Each Field shows its message at once, clears it on
its own next change, and the Form focuses the first Field with an error, once.

```tsx
const [state, action] = useActionState(signUp, { errors: {} })

<Form.Root aria-label="Sign up" action={action} errors={state.errors}>…</Form.Root>
```

## Reset

- A **reset button** (or `form.reset()` during a user interaction) clears every Field's
  errors, server errors included, and its touched and dirty flags.
- React 19's **automatic reset after an action** keeps the server errors that action
  returned, so `useActionState` errors stay visible.
- A reset whose event was `preventDefault()`ed changes nothing.

## Announcements

A failed attempt with two or more invalid Fields is announced once, politely ("3 fields
have errors"); with one, focus speaks for itself. Fields do not announce individually for
an attempt.

### Recipe: an error summary

```tsx
<Form.Root aria-label="Sign up" errors={errors}>
  {Object.keys(errors).length > 0 && (
    <ul>
      {Object.entries(errors).map(([name, message]) => (
        <li key={name}><a href={`#${name}`}>{String(message)}</a></li>
      ))}
    </ul>
  )}
  …
</Form.Root>
```

## Testing

```tsx
import { getForm } from "@rind-ui/testing"

const form = getForm(screen, { name: "Sign up" })
await form.submit()
expect(await form.invalidFields()).toEqual(["email", "password"])
expect(await form.focusedField()).toBe("email")
expect((await form.announcements()).map((a) => a.message)).toEqual(["2 fields have errors"])
```

## Accessibility tree

A sign-up form (generated from the state story):

<!-- aria:form--sign-up -->
```yaml
- form "Sign up":
  - text: Email
  - textbox "Email"
  - text: Password
  - textbox "Password"
  - text: Confirm password
  - textbox "Confirm password"
  - button "Submit"
  - button "Reset"
  - button "Validate"
  - paragraph: "Submissions: 0"
```
<!-- /aria -->

## Tested with

<!-- tested-with:form -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
