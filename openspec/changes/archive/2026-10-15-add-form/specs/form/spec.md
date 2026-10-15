## Purpose

Defines rind-ui's Form: a native `<form>` that validates every Field it contains on a
submit attempt, focuses the first invalid one, holds a submission for pending async
validators, maps server errors to Fields by name, announces a failed attempt once, and
resets Field state with rules that survive React form actions. Introduced by `add-form`.

## ADDED Requirements

### Requirement: Anatomy

The Form SHALL consist of one part, `root`, rendering a `<form>` that forwards every
attribute of `<form>`. Its props are `validationMode`, `validationBehavior` (defaults for
its Fields), `errors` (a read-only map from Field `name` to a message or a list of
messages), `onFormSubmit(values, details)` and `messages`. It SHALL expose an imperative
`validate(name?)`. In `"native"` behaviour the form SHALL NOT carry `novalidate` unless the
consumer sets it; in `"aria"` behaviour it SHALL carry `novalidate`.

#### Scenario: Native attributes kept

- **WHEN** a Form is rendered with `action="/signup"`, `method="post"` and `aria-label="Sign up"`
- **THEN** the `<form>` carries them, and its role is `form` with the name "Sign up"

### Requirement: Submit Attempt

A submit attempt (a submit button, Enter implicit submission, `requestSubmit()`, or
`validate()`) SHALL validate every registered Field, displaying errors as if each Field had
recorded a submit attempt, and SHALL then:

- if any Field is invalid, cancel the submission and move focus once to the first invalid
  Field's control in tree order, with modality `keyboard`, without selecting its text;
- if no Field is invalid and none is validating, let the submission proceed.

The focus move SHALL be tied to that attempt only: a later change of Fields, values or
errors SHALL NOT move focus unless it belongs to a new attempt (or to server errors, see
below). Fields removed before the attempt SHALL be ignored.

#### Scenario: Tree order, not registration order (base-ui#5284, ariakit#6305)

- **WHEN** a Field is inserted above an existing Field, both are invalid, and the form is
  submitted
- **THEN** the inserted Field's control is focused and shows a focus ring

#### Scenario: No later focus theft (ariakit#6307)

- **WHEN** a failed submit is followed by a successful one, and later a Field is added
- **THEN** focus does not move when the Field is added

#### Scenario: Removed field (base-ui#2228)

- **WHEN** a Field is unmounted and the form is then submitted
- **THEN** no error is thrown and only mounted Fields are validated

#### Scenario: Cross-field rule (radix#2566)

- **WHEN** "Confirm password" has a `validate` that compares with "Password", the user
  changes "Password" after both were valid, and submits
- **THEN** "Confirm password" is validated again with the new values and the submission is
  cancelled

#### Scenario: Programmatic validate reveals errors (ariakit#2397)

- **WHEN** the consumer calls `validate()` on a Form whose Fields were never touched
- **THEN** every invalid Field displays its error and no focus moves

### Requirement: Values On Submit

When `onFormSubmit` is given and a submission proceeds, the Form SHALL cancel the native
submission and call `onFormSubmit(values, details)` with an object mapping each registered
Field's `name` to its control's typed value (strings, booleans, arrays, numbers, as each
control defines it), and details carrying the native `SubmitEvent` and its submitter.
Without `onFormSubmit` the native submission, `onSubmit` and `action` behave as without
rind-ui.

#### Scenario: Typed values

- **WHEN** a Form with a Text Field `email`, a Checkbox `news` and a Checkbox Group
  `topics` is submitted with `onFormSubmit`
- **THEN** the values are `{ email: "a@b.co", news: true, topics: ["ai", "css"] }`

### Requirement: Asynchronous Validation Holds The Submission

When a submit attempt finds a Field validating (an async `validate` pending), the Form SHALL
cancel that submission, enter a validating state (`data-validating` on the root), and, once
every Field has settled, either focus the first invalid Field or re-request the submission
with the same submitter. A new attempt during the wait SHALL replace the pending one.

#### Scenario: Username check

- **WHEN** a Field's async `validate` for "username" is pending and the user presses the
  submit button
- **THEN** no submission happens until the check resolves; if it resolves valid, exactly
  one submission happens, with the same submitter

### Requirement: Server Errors

The Form SHALL give each Field the messages in `errors` under that Field's exact `name`
(dotted and bracketed names are matched as strings). These are the Field's external
errors (`field-validation`): shown immediately, and cleared by that Field's next accepted
change. When `errors` changes after a submission proceeded, the Form SHALL focus the first
Field, in tree order, that has a server error, with modality `keyboard`, once. Validity
SHALL be kept per Field: two Fields with the same `name` both receive the messages, and
each clears its own.

#### Scenario: Errors returned after submit

- **WHEN** a submission proceeds and the parent then passes
  `errors={{ email: "Already registered" }}`
- **THEN** the email Field shows "Already registered", its control is focused, and its
  native validity is invalid

#### Scenario: Nested name (ariakit#3607)

- **WHEN** `errors` contains `{ "items.0.name": "Required" }`
- **THEN** the Field named `items.0.name` shows "Required"

#### Scenario: Cleared by the field's own change (base-ui#1745)

- **WHEN** a Radio Group named `plan` shows a server error and the user selects another
  plan
- **THEN** that error disappears, and other Fields' server errors remain

### Requirement: Failed Attempt Announcement

When a submit attempt fails with two or more invalid Fields, the Form SHALL announce,
through the injected Announcer, politely, once per attempt,
`messages.invalidSummary(count)` (default "2 fields have errors"). With one invalid Field
it SHALL announce nothing (the focused Field's name and described error are spoken). When
server errors are applied to two or more Fields, it SHALL announce the same summary once.
Fields SHALL NOT announce individually for the attempt.

#### Scenario: Three invalid fields

- **WHEN** a form with three invalid Fields is submitted
- **THEN** exactly one announcement "3 fields have errors" is made, and focus is on the
  first invalid control

#### Scenario: One invalid field

- **WHEN** a form with one invalid Field is submitted
- **THEN** no announcement is made and the Field's control is focused

### Requirement: Reset

On the form's `reset` event:

- if it is `defaultPrevented`, nothing SHALL change;
- if it was initiated by the user (a reset button, or `form.reset()` called during a user
  interaction), every Field SHALL reset its validation state as `field-validation`'s Reset
  defines, including server errors;
- if it was requested by the framework after a form action completed (React 19's
  automatic reset of uncontrolled forms), Fields SHALL reset `touched`, `dirty` and the
  submit-attempt flag, but SHALL keep the server errors delivered since the submission.

Controls reset their own values (`hidden-form-input`, Text Field).

#### Scenario: Errors survive the action reset (react-spectrum#6830, react-spectrum#7708)

- **WHEN** a Form uses a React 19 `action` with `useActionState` that returns
  `{ errors: { email: "Already registered" } }`, and React resets the form after the
  action
- **THEN** the email Field shows "Already registered" after the reset

#### Scenario: Reset button clears everything

- **WHEN** a Form with displayed client and server errors is reset by its reset button
- **THEN** no Field shows an error and none is touched or dirty

#### Scenario: Prevented reset (react-spectrum#7602)

- **WHEN** the consumer calls `preventDefault()` on the `reset` event
- **THEN** Fields keep their values, errors and flags

### Requirement: Nested Forms

A Form SHALL provide a fresh form context to its subtree and SHALL NOT inherit any prop,
Field registration or error map from an enclosing Form, including through a portal.

#### Scenario: Form in a portalled dialog (react-spectrum#10740)

- **WHEN** a Form with `validationMode="change"` renders a Dialog whose content contains
  another Form without props
- **THEN** the inner Form's Fields use the default `"submit"` mode, and submitting the
  inner Form validates only its own Fields

### Requirement: Data Attributes

The root SHALL carry `data-scope="form"`, `data-part="root"`, `data-instance`,
`data-validating` while a submission is held, and `data-invalid` after a failed attempt
until the next attempt or reset.

#### Scenario: Styling a failed form

- **WHEN** a submission fails
- **THEN** the root carries `data-invalid`, and after the errors are fixed and the form is
  submitted again it does not

### Requirement: Contract

The Form SHALL ship a contract with scope `form`, anatomy `root`, located by role `form`
and exact accessible name (or by `data-scope` and an instance id when unnamed), with:

- actions:
  - `submit`: pointer click on the submit button with the given name (default "Submit");
    keyboard: focus it and press Enter. Postcondition: the form submitted, or `isInvalid`
    is `true`.
  - `reset`: pointer click on the reset button with the given name (default "Reset");
    keyboard: focus it and press Enter.
  - `validate`: calls the imperative `validate()` through the story's exposed handle;
    keyboard declared as none, with the reason "programmatic".
- queries: `isInvalid`, `isValidating`, `invalidFields` (the names of invalid Fields in
  tree order), `focusedField` (the name of the Field containing focus, or `null`),
  `submissions` (the number of submissions that proceeded, recorded by the story);
- states: `idle`, `validating`, `awaiting-server`;
- events: `SUBMIT.ATTEMPT` → `submit`, `RESET` → `reset`, prop steps `$props:errors`;
- traits: none.

Drivers SHALL expose the announcements made since the driver was created.

#### Scenario: Driver

- **WHEN** a test fills two Fields with invalid values through their drivers and runs
  `getForm(screen, { name: "Sign up" }).submit()`
- **THEN** `invalidFields()` returns both names in tree order, `focusedField()` returns the
  first, and the driver's announcements contain one summary

### Requirement: Form Invariants

The Form contract SHALL ship, always on, the invariant that after a failed attempt focus is
inside the first invalid Field. `@rind-ui/testing` SHALL export two more invariants as
consumer invariants usable with `testMachine(formContract, { invariants })`
(`formStepInvariants()`), because they need the step that ran and the page's announcement
log, which the shared invariant API does not carry: a step that is not a submit attempt and
does not change `errors` never moves focus; each failed attempt produces at most one Form
announcement and no Field announcement.

#### Scenario: Broken variant focuses by registration order

- **WHEN** a broken Form variant focuses the first registered invalid Field and the
  model-based tests insert a Field above it
- **THEN** the submit step fails, naming the invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Form root through its `data-*` attributes only, in
`form.css`: the vertical rhythm between Fields and Fieldsets from `--rind-form-gap`, read
with a semantic fallback. The Form belongs to no variant family.

#### Scenario: Stylesheet alone

- **WHEN** a consumer imports `tokens.css`, `form.css` and `field.css`
- **THEN** Fields inside a Form are spaced by the form gap
