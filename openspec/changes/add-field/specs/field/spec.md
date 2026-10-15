## Purpose

Defines rind-ui's Field component: the wrapper that gives one form control a label, a
description and an error message, carries `disabled`/`readOnly`/`required`/`invalid` to it
(`field-control`), validates it (`field-validation`), and exposes its validation state as
data attributes and through a contract. Introduced by `add-field`.

## ADDED Requirements

### Requirement: Anatomy

The Field SHALL consist of a `root` part (`div`), an optional `label` part (`label`, the
`control-label` Label bound to the registered control), an optional `description` part
(`p`) and an optional `error-message` part (`p`). It wraps exactly one rind-ui form control.
Every part SHALL accept element substitution and forward the attributes of its element.
The root SHALL have no role. Its props are `name`, `disabled`, `readOnly`, `required`,
`invalid`, `touched`, `dirty`, `validate`, `validationMode`, `validationBehavior`,
`validationDebounce`, `errorMessageAttribute` (`"describedby"` default, or `"both"`) and
`messages`.

#### Scenario: Text Field in a Field

- **WHEN** `<Field.Root><Field.Label>Email</Field.Label><TextField.Input/>
  <Field.Description>We never share it</Field.Description></Field.Root>` is rendered
- **THEN** the input's accessible name is "Email", its accessible description is "We never
  share it", and the root has no `role` attribute

### Requirement: Error Message Content

The ErrorMessage SHALL be rendered only while the Field displays an error, mounted and
unmounted through `presence` so exit animations can run. By default it SHALL contain the
displayed messages: one message as text, several as a list. When the consumer passes
children, they SHALL replace the default text; children that render nothing (`null`,
`undefined`) SHALL fall back to the default text. A `match` prop naming a validity key
(`valueMissing`, `typeMismatch`, `patternMismatch`, `tooShort`, `tooLong`,
`rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `badInput`, `customError`) SHALL render
the ErrorMessage only when that key is the cause, so a Field can carry one message per
constraint. Messages for native constraints SHALL come from `messages` when the consumer
overrides that key, else from the browser's `validationMessage`.

#### Scenario: One message per constraint

- **WHEN** a Field has an ErrorMessage `match="valueMissing"` "Enter your email" and one
  `match="typeMismatch"` "That is not an email", and is submitted with "abc"
- **THEN** only "That is not an email" is rendered and referenced by the control

#### Scenario: Null children fall back (react-spectrum#7034)

- **WHEN** an ErrorMessage's render function returns `null` for a server error
- **THEN** the server error's text is rendered

#### Scenario: Control stays in place (react-spectrum#2681)

- **WHEN** the ErrorMessage appears while the control is focused
- **THEN** the control keeps focus and its DOM node is the same element

### Requirement: Data Attributes

Every Field part SHALL carry `data-scope="field"`, its `data-part` (`root`, `label`,
`description`, `error-message`) and `data-instance`, and the Field's state:
`data-disabled`, `data-readonly`, `data-required`, `data-valid` or `data-invalid` (neither
before the Field has displayed a validation result, nor while disabled), `data-validating`,
`data-touched`, `data-dirty`, `data-filled`, and, on the root, `data-focus` and
`data-focus-visible` mirrored from the control. The registered control's own root part
SHALL carry the same validation attributes (`data-valid`, `data-invalid`,
`data-validating`, `data-touched`, `data-dirty`, `data-filled`).

#### Scenario: Styling a required select before interaction (bits-ui#1021)

- **WHEN** a required, empty Select in a Field is rendered and then submitted
- **THEN** before submit the Field root has neither `data-valid` nor `data-invalid`, and
  after submit the root and the Select trigger carry `data-invalid`

### Requirement: Messages

The Field SHALL take a typed `messages` object (`i18n-messages`) with English defaults:
`errorAnnouncement(label, message)` and one optional override per validity key (no default:
the browser's message is used). No string the Field sends to assistive technology SHALL be
hard-coded outside `messages`.

#### Scenario: Localised constraint message

- **WHEN** a Field sets `messages.valueMissing` to "Campo obbligatorio" and is submitted
  empty
- **THEN** the ErrorMessage text and the native `validationMessage` are
  "Campo obbligatorio"

### Requirement: Contract

The Field SHALL ship a contract with scope `field`, anatomy `root`, `label`,
`description`, `error-message`, located by its Label's exact text (or by `data-scope` and an
instance id when it has no Label), with:

- actions:
  - `focus`: keyboard Tab until the registered control has focus; pointer: click the
    Label. Postcondition: the control has focus.
  - `blur`: keyboard Tab away from the control; pointer: press outside every layer.
    Postcondition: `isTouched()` is `true`.
- queries: `isValid`, `isInvalid`, `isValidating`, `isTouched`, `isDirty`, `isFilled`,
  `isRequired`, `isDisabled`, `isReadOnly`, `errors` (the rendered ErrorMessage texts),
  `description`, `label`, `controlName` (the control's accessible name),
  `controlDescription`;
- states: `idle`, `validating`, `valid`, `invalid`, observed through the root's data
  attributes;
- events: `FOCUS.LEAVE` → `blur`; value events are driven through the composed control's
  driver; prop events through prop steps (`$sync:invalid`, `$props:errors`,
  `$props:validationMode`, `$props:disabled`);
- traits: none of its own; the control's contract declares `field-associated`.

The Field driver SHALL compose with a control driver: `getField(screen, { label })
.control(getTextField)` returns the control's driver located inside the Field.

#### Scenario: Composed driver

- **WHEN** a test runs `const email = getField(screen, { label: "Email" })`,
  `await email.control(getTextField).fill("a@")`, then submits the form
- **THEN** `await email.isInvalid()` is `true` and `await email.errors()` contains the
  email message

### Requirement: Field Invariants

The Field contract SHALL ship invariants, always on, checked after every model-based step:

- the control carries `aria-invalid` (where its role allows it) exactly when the Field
  displays invalid, and exactly then an ErrorMessage is rendered (unless every
  ErrorMessage has a `match` that does not apply);
- the control's `aria-describedby` lists only rendered parts and never an empty string;
- the control's accessible name equals the Label's text when a Label is rendered;
- no announcement is made for a step that did not change the displayed message, and each
  distinct displayed message produces at most one announcement until it clears;
- a disabled Field has neither `data-valid` nor `data-invalid`.

#### Scenario: Broken variant announces on every key

- **WHEN** a broken Field variant announces its error on every change and is run through
  the model-based tests in `change` mode
- **THEN** the second typing step fails, naming the announcement invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Field through its `data-*` attributes only, in
`field.css`: spacing between parts, the Label's text style, the Description's muted text,
the ErrorMessage in the danger role with an icon drawn in `currentColor`, so the error is
not shown by colour alone and stays visible in forced colors. It SHALL read only
`--rind-field-*` tokens with semantic fallbacks. The Field belongs to no variant family.

#### Scenario: Error visible in forced colors

- **WHEN** an invalid Field is rendered with forced colors emulated
- **THEN** the ErrorMessage text and its icon are visible
