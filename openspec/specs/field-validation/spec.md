# field-validation Specification

## Purpose
Defines how a Field validates its control and what it shows: the sources of an error and
their order, native constraint validity as the single source of truth, when errors are
displayed (validation mode), whether invalid values block submission (validation
behaviour), asynchronous validators, the touched/dirty/filled flags, focus on the first
invalid control, and the announcements that make an appearing error perceivable.
Introduced by `add-field`; Form (`add-form`) adds submission-wide behaviour on top.
## Requirements
### Requirement: Sources And Order

A Field's current error SHALL be computed in one synchronous step from these sources, the
first that reports an error winning:

1. the Field's controlled `invalid` prop: `true` forces invalid with no message, `false`
   forces valid, `undefined` leaves validation to the other sources;
2. external errors given to the Field (server errors from Form);
3. the control's native constraint validity (`required`, `minLength`, `maxLength`,
   `pattern`, `type`, `min`, `max`, `step`) and any validity message the control owns on its
   validity element (for example Date Field's `badInput`), with its message;
4. the Field's `validate(value, values)` function, run only when native constraints pass,
   with the value carried by the change being validated and the current typed values of
   every Field in the same form. It returns `null`/`undefined` (valid), a string, an
   array of strings, or a promise of one of those.

Only the winning source's messages SHALL be shown. A disabled Field SHALL be neither valid
nor invalid, and SHALL show no error.

#### Scenario: Native before custom (base-ui#1904, ariakit#2282)

- **WHEN** a required Field with a `validate` function is submitted empty
- **THEN** only the native "required" message is shown, and `validate` has not run

#### Scenario: Control-owned message counts as native

- **WHEN** a control sets its own validity message on its validity element and the Field has a
  `validate` function
- **THEN** the control's message is the winning source 3 message, ordered before `validate`
  (which has not run), and is displayed per the validation mode

#### Scenario: Validate gets the new value (base-ui#1844)

- **WHEN** the user types "a" into an empty Field in `change` mode
- **THEN** `validate` receives `"a"`

#### Scenario: Invalid back to undefined (base-ui#3777)

- **WHEN** a Field's `invalid` prop goes from `true` to `undefined` while its value is valid
- **THEN** the Field shows no error, and after its next validation it carries
  `data-valid`; with `invalid={false}` it carries `data-valid` immediately

#### Scenario: Disabled field

- **WHEN** an invalid, displayed Field becomes disabled
- **THEN** its ErrorMessage is removed, the control has no `aria-invalid`, and the root has
  neither `data-valid` nor `data-invalid`

### Requirement: Native Validity Is The Source Of Truth

Whenever the Field's current error comes from a non-native source (controlled `invalid`,
external errors, `validate`), the Field SHALL set it on the control's native validity
element with `setCustomValidity`, joining the messages with a newline; when that source
no longer reports an error it SHALL clear the custom validity it set, and only that one.
`form.checkValidity()`, `:invalid` and form submission SHALL therefore agree with what the
Field displays (in `native` behaviour). A message set by someone else SHALL be restored
when the Field clears its own.

#### Scenario: checkValidity agrees (kobalte#473)

- **WHEN** a Field's `validate` returns "Username taken" and script calls
  `form.checkValidity()`
- **THEN** it returns `false`, and the control's native `validationMessage` is
  "Username taken"

#### Scenario: Custom validity is cleared before reading

- **WHEN** a value that failed `validate` is corrected so that `validate` passes
- **THEN** the native validity element reports `valid`, and no stale custom error remains

### Requirement: Validation Mode

A Field's `validationMode` SHALL default to the enclosing Form's, else `"submit"`, and SHALL
decide when errors are displayed:

- `"submit"`: nothing is displayed until the first submit attempt (a submission, the
  native `invalid` event from `requestSubmit`, `reportValidity`, or Form's `validate()`);
  from then on the Field re-validates and updates its display on every change;
- `"blur"`: an error is displayed when focus leaves the field after its value changed, or
  on a submit attempt; from then on on every change;
- `"change"`: an error is displayed on every change, and on a submit attempt.

The current error SHALL always be computed and set as native validity regardless of mode;
the mode only gates display. Once an error is displayed, every accepted change, including
a controlled value changed by the parent, SHALL re-validate, and a fixed value SHALL clear
the display immediately. Every control type SHALL follow the same rule.

#### Scenario: Default mode is quiet until submit (base-ui#2142)

- **WHEN** the user types an invalid email into a Field in the default mode and tabs away
- **THEN** no error is shown and the control has no `aria-invalid`; after a submit attempt
  the error is shown

#### Scenario: Error clears while typing the fix (react-spectrum#6983)

- **WHEN** an email Field displays an error after a submit attempt and the user types the
  missing domain
- **THEN** the error disappears with the keystroke that makes the value valid

#### Scenario: Parent fixes a controlled value (react-spectrum#8659)

- **WHEN** a displayed invalid Field's controlled value is changed by the parent to a valid
  one
- **THEN** the error disappears and a following submission succeeds

#### Scenario: Same rule for selection controls (react-spectrum#6096)

- **WHEN** a Radio Group in a Field in the default mode is selected and then cleared
  before any submit attempt
- **THEN** no error is shown, as for a Text Field

#### Scenario: Paste and autofill (radix#2542)

- **WHEN** after a submit attempt the user pastes a valid value, or the browser autofills
  one
- **THEN** the error disappears

### Requirement: Required Is Not Shown While Tabbing

In `"blur"` and `"change"` modes, a Field whose only error is a missing value SHALL NOT
display it until its value has been changed at least once. A submit attempt SHALL always
display it.

#### Scenario: Tabbing through (base-ui#1425)

- **WHEN** the user tabs through an empty required Select in `"blur"` mode
- **THEN** no error is shown; after a submit attempt "required" is shown

### Requirement: Validation Behaviour

A Field's `validationBehavior` SHALL default to the enclosing Form's, else `"native"`:

- `"native"`: native constraints apply (`required` is the native attribute) and an invalid
  Field blocks form submission;
- `"aria"`: no constraint attribute is set on the native validity element (`required`
  becomes `aria-required` on the control), the Field still validates and displays per its
  mode, and submission is never blocked by it.

#### Scenario: Native blocks (react-spectrum#7317)

- **WHEN** a form with an empty required Field in `"native"` behaviour is submitted
- **THEN** the `submit` event does not fire and the error is displayed

#### Scenario: Aria does not block

- **WHEN** the same form uses `"aria"` behaviour
- **THEN** the `submit` event fires, the control has `aria-required="true"` and no
  `required` attribute, and the error is displayed after the attempt

### Requirement: Browser Validation Bubble

When the native `invalid` event fires on the control's validity element, the Field SHALL
cancel it, suppressing the browser's own bubble, only if the Field renders an ErrorMessage
part; otherwise the browser's bubble SHALL be shown, so an error is never silent. In both
cases the Field SHALL record a submit attempt and display its error.

#### Scenario: No ErrorMessage part

- **WHEN** a required Field without an ErrorMessage part is submitted empty
- **THEN** the browser shows its validation bubble on the control

#### Scenario: ErrorMessage part

- **WHEN** the same Field renders an ErrorMessage
- **THEN** no browser bubble is shown and the ErrorMessage shows the message

### Requirement: Focus On The First Invalid Control

When interactive validation fails (a submission with invalid Fields), focus SHALL move
once to the first invalid control in tree order (the order of the form's elements, not
registration or mount order), through the control's registered focus target, with
modality `keyboard` so it shows a focus ring. A text input's content SHALL NOT be
selected. This SHALL work in a plain `<form>`, with no rind-ui Form.

#### Scenario: Tree order (base-ui#5284, ariakit#6305)

- **WHEN** a Field is mounted above an existing invalid Field and the form is submitted
  with both invalid
- **THEN** the upper Field's control is focused and carries `data-focus-visible`

#### Scenario: Plain form

- **WHEN** two invalid Fields with ErrorMessage parts are inside a plain `<form>` and its
  submit button is clicked
- **THEN** the first Field's control is focused and both errors are displayed

### Requirement: Asynchronous Validation

When `validate` returns a promise, the Field SHALL enter a validating state
(`data-validating`) until it settles, keep any error already displayed until then, and
apply only the result of the latest validation, dropping results of validations started
before a newer change. `validationDebounce` (milliseconds, default 0) SHALL delay
`validate` for non-empty values typed in `change` mode, through the injected scheduler.

#### Scenario: Stale result dropped

- **WHEN** the user types "ab" then "abc", the check for "ab" resolves after the check for
  "abc"
- **THEN** the displayed result is the one for "abc"

#### Scenario: Debounce with fake timers

- **WHEN** `validationDebounce` is 300 and the user types three characters 100 ms apart
- **THEN** `validate` runs once, 300 ms after the last character

### Requirement: External Errors

A Field SHALL accept external errors (from Form, by the Field's name). They SHALL be
displayed immediately, whatever the mode, and SHALL be cleared for that Field on its next
accepted user change, in the same step that then runs the other sources, so client
validation still applies. A commit, a blur, a refused change or a change of another Field
SHALL NOT clear them.

#### Scenario: Cleared by the next change, then validated (base-ui#1745, base-ui#4095)

- **WHEN** a Select shows the server error "Not available" and the user picks another
  option that fails `validate`
- **THEN** the server error disappears and the `validate` error is shown

#### Scenario: Blur does not clear (react-spectrum#9444)

- **WHEN** a Field shows a server error and the user focuses and leaves it without
  changing the value
- **THEN** the server error is still shown

### Requirement: Touched, Dirty And Filled

A Field SHALL track:

- `touched`: focus has left the field at least once. Focus moving into a popup layer
  opened from the control (its listbox, its calendar) does not count as leaving;
- `dirty`: the value differs from the value the Field had when its control first
  registered. The baseline is captured once per Field, not per registration;
- `filled`: the value is not empty.

Each SHALL be controllable through a prop of the same name, and SHALL be reset by a form
reset (see Reset). Each flag SHALL change only when its value changes, so typing in an
uncontrolled Text Field does not re-render parts that do not read the value.

#### Scenario: Popup does not touch

- **WHEN** the user opens a Select inside a Field with the keyboard, moves through its
  options and closes it with Escape
- **THEN** the Field is not touched until focus leaves the trigger

#### Scenario: Back to the initial value

- **WHEN** the user changes a Text Field's value and then restores the original text
- **THEN** the Field is not dirty

### Requirement: Reset

When the form that contains the Field's validity element fires a `reset` event that is
not `defaultPrevented`, the Field SHALL clear `touched`, `dirty` and its submit-attempt
flag, clear its displayed error, its custom validity and its external errors, and re-read
`filled` from the control after the control has reset. A `reset` that was
`defaultPrevented` SHALL change nothing. (Which resets keep server errors delivered by a
React action is decided in `add-form`.)

#### Scenario: Reset prevented (react-spectrum#7602)

- **WHEN** a consumer cancels the form's `reset` event
- **THEN** the Field's error and flags are unchanged

#### Scenario: Filled after reset (base-ui#5765)

- **WHEN** a filled Text Field's form is reset to an empty default
- **THEN** the Field no longer carries `data-filled`

### Requirement: Announcements

ErrorMessage SHALL NOT be a live region. The Field SHALL announce an error through the
injected Announcer, politely, keyed per Field, at most once per distinct message until
that error is cleared:

- when the error becomes displayed while focus is not on the control (blur mode after the
  user moved on, an asynchronous result, an external error that did not move focus);
- when the error becomes displayed or its message changes while the control has focus (in
  `change` mode, or Enter submitting from the focused control), coalesced by the
  announcer's key debounce;
- the announcement text SHALL be `messages.errorAnnouncement(label, message)` (default
  "<label>: <message>").

The Field SHALL NOT announce when a failed submission moved focus to its control (the
focus speaks the name and the described error), when the error is cleared, or while the
control is composing text.

#### Scenario: Error appears after tabbing on

- **WHEN** in `"blur"` mode the user changes an email Field to an invalid value and tabs to
  the next field
- **THEN** one polite announcement "Email: Enter a valid email" is made

#### Scenario: Enter-submit from the focused field (react-spectrum#8328)

- **WHEN** the user presses Enter in the only, focused, invalid Field of a form and its
  error becomes displayed while focus stays on it
- **THEN** one polite announcement of the error is made

#### Scenario: Same message twice

- **WHEN** a displayed error keeps the same message while the user types two more
  invalid characters
- **THEN** no further announcement is made

#### Scenario: Failed submit moves focus

- **WHEN** a submission fails and focus moves to the Field's control
- **THEN** the Field itself makes no announcement

