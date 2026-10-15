## Why

Field (`add-field`) validates and displays one control and works in a plain `<form>`. Some
behaviour needs the whole form: server errors mapped to Fields by name, typed values on
submit, holding a submission while async validators finish, one focus move and one
announcement per failed attempt, and a reset policy that survives React 19 form actions
(their automatic reset wiped the errors the action had just returned: react-spectrum#6830,
react-spectrum#7708).

Research: [form](../../../docs/research/form.md) · [field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §7 ·
[native-platform](../../../docs/research/native-platform.md) §14

Depends on: `add-foundations`, `add-a11y-foundations` (`announcer`, `i18n-messages`,
`interaction-modality`), `add-checkbox` (`hidden-form-input`: reset, implicit submission),
`add-field` (`field`, `field-control`, `field-validation`), `add-button` (submit and reset
buttons).

## What Changes

- A public **Form** component with one part, `Root` (`<form>`). Props:
  - `validationMode` and `validationBehavior`: defaults for its Fields;
  - `errors`: server errors keyed by Field `name`;
  - `onFormSubmit(values, details)`: opt-in, typed values from the registered Fields;
  - `validate(name?)`: an imperative action.

  Native `onSubmit`, `action` and `noValidate` keep their meaning.
- **Submit attempt**: every Field is validated, and focus moves once to the first invalid
  control in tree order (one-shot per attempt). A submission is held while async
  validators run, then re-requested with the same submitter.
- **Server errors**: displayed on the Field with that exact `name`. After a valid submit,
  the first Field with a server error is focused. A Field clears its own server error on
  its next accepted change.
- **One polite announcement per failed attempt** when two or more Fields are invalid. With
  one, the focused Field speaks for itself.
- **Reset**:
  - a user reset clears every Field's validation state;
  - a reset that React performs after a form action keeps the server errors the action
    delivered;
  - a `defaultPrevented` reset does nothing.
- A nested Form (for example in a portalled dialog) does not inherit its ancestor's
  context.
- The form **contract and driver** (`getForm`), plus stories (including React 19
  `useActionState`), a theme stylesheet and a docs page.

## Capabilities

### New Capabilities

- `form`: the Form component: submission, validation of all Fields, focus on the first
  invalid Field, async hold, server errors, summary announcement, reset policy, nesting,
  contract, theme.

### Modified Capabilities

None. The reset-target question for `hidden-form-input` is listed in design.md under
"Requests to other changes".

## Non-goals

- A form state store (values, arrays, `FormPush`/`FormRemove` like Ariakit) or a schema
  resolver. Form reads values from the registered Fields; field arrays are consumer state.
- Submission status UI (pending, success): the submit Button's `pending` (`add-button`)
  and the consumer.
- `Form.Submit` / `Form.Reset` parts: they would be Buttons with one prop.
- Multi-step wizards and error summaries rendered as lists of links (a docs recipe).
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/form/` (machine, connect, contract, messages).
- `packages/react/src/form/`: `Form.Root`, the form context Fields read, and React 19
  action-reset detection.
- `@rind-ui/testing`: `getForm`.
- `@rind-ui/theme/form.css`, stories, docs.
- No new runtime dependency.
