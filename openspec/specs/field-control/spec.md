# field-control Specification

## Purpose
Defines the binding between a Field and the one rind-ui form control inside it: how the
control registers, how the Field's label, description and error reach it, how
`disabled`/`readOnly`/`required`/`invalid` propagate, and how the control reports changes
for validation. Every rind-ui form control implements it. Introduced by `add-field`; Text
Field is its first implementation.
## Requirements
### Requirement: One Registered Control

A rind-ui form control rendered inside a Field SHALL register with it once, giving its
id, whether its focusable element is labelable, a focus operation, its native validity
element (the native input itself, or the hidden input of `hidden-form-input`) and a reader
for its typed value. It SHALL unregister on unmount. A group control (Checkbox Group,
Radio Group) SHALL register as one control, and its items SHALL NOT register. A second
control registering with the same Field SHALL produce a development warning that names
both and recommends a Fieldset, and only the first SHALL be wired. Inputs that a control
renders for its own purposes (a Combobox's popup search input, a Select's typeahead) SHALL
NOT receive the Field's wiring.

#### Scenario: Radio items keep their own ids (base-ui#4121)

- **WHEN** a Radio Group with three items is inside a Field
- **THEN** the three item ids are distinct, the Field's label names the radio group, and no
  warning is emitted

#### Scenario: Two controls in one Field (zag#2475)

- **WHEN** a Text Field and a Select are rendered inside the same Field
- **THEN** a development warning names both, the Text Field is wired, and the Select keeps
  its own attributes

#### Scenario: Popup input does not inherit (base-ui#4120)

- **WHEN** a Combobox with an input inside its popup is in an invalid Field
- **THEN** only the Combobox's registered input carries `aria-invalid` and the Field's
  `aria-describedby` ids

#### Scenario: Removed control

- **WHEN** a Field's control is unmounted and the form is submitted
- **THEN** nothing is focused or validated for that Field and no error is thrown
  (base-ui#2228)

### Requirement: Labelling Through The Field

A registered control SHALL be named by the Field's Label, following `control-label`: a
labelable control is referenced by the Label's `for`; a non-labelable control (a group, a
substituted element) carries `aria-labelledby` pointing at the Label, and a press on the
Label focuses it through `label-interaction`. Clicking the Field's Label SHALL focus the
control. A toggle control (Checkbox, Switch) SHALL also activate once, as natively, and a
popup trigger SHALL NOT open (`label-interaction`). A control's own Label part rendered
inside a Field SHALL produce a development warning, and the Field's Label SHALL name the
control. A consumer `aria-label` or `aria-labelledby` on the control SHALL be used as given.

#### Scenario: Label focuses a Select trigger (base-ui#2113, base-ui#1051)

- **WHEN** the user clicks the Field Label of a Select
- **THEN** the Select's trigger, not its hidden input, is focused, and the Select stays
  closed

#### Scenario: Label of a Checkbox

- **WHEN** the user clicks the Field Label of a Checkbox once
- **THEN** the Checkbox toggles once and its accessible name is the Label's text

#### Scenario: No Label rendered (ark#3824)

- **WHEN** a Field renders no Label and its control has `aria-label`
- **THEN** the control carries no `aria-labelledby` and no element has a `for` pointing at
  it

### Requirement: Description And Error Wiring

The registered control's `aria-describedby` SHALL list, in this order: the Field's
Description id, the Field's ErrorMessage id while the ErrorMessage is rendered, the
control's own description ids, and the consumer's ids. It SHALL list only parts that are
currently rendered, and SHALL be omitted when empty. The error SHALL never be added to
`aria-labelledby`. `aria-errormessage` SHALL be emitted only when the consumer sets the
Field's `errorMessageAttribute` to `"both"`, and then only while the ErrorMessage is
rendered and the control is `aria-invalid`.

#### Scenario: Error appears and goes (react-spectrum#2330)

- **WHEN** a Field with a Description shows an error and the user then fixes the value
- **THEN** while the error is shown the control's accessible description is the
  Description followed by the error text, and afterwards it is the Description alone, with
  no dangling id

#### Scenario: VoiceOver reads the error (ark#4150, react-spectrum#7425)

- **WHEN** a Field shows the error "Enter a valid email" with default settings
- **THEN** the control's `aria-describedby` contains the ErrorMessage id and the control
  has no `aria-errormessage`

#### Scenario: Error never in the label (kobalte#534)

- **WHEN** a Field shows an error
- **THEN** the control's accessible name is the Label's text only

### Requirement: State Propagation

A registered control's effective state SHALL be:

- `disabled`: its own prop, or the Field's `disabled`, or an enclosing disabled Fieldset
  (`add-fieldset`);
- `readOnly` and `required`: its own prop or the Field's;
- invalid: its own `invalid` prop or the Field's displayed invalid state
  (`field-validation`).

The control SHALL apply them exactly as it applies its own props: native attributes or
their ARIA equivalents, and its state data attributes. `aria-invalid` SHALL be set by ROLE, not by element:
on every role that supports it (`textbox`, `combobox` — including a Select trigger,
which is a `<button>` with role `combobox` — `checkbox`, `radiogroup`, `slider`,
`spinbutton`, `listbox`, …) and never on role `button`, where the error in
`aria-describedby` and `data-invalid` carry the state. Every Field part and
the control's own parts SHALL carry the same state data attributes.

#### Scenario: Matrix (ark#3930, ark#3286)

- **WHEN** a Field with `disabled`, then `readOnly`, then `required` wraps each rind-ui
  form control in turn
- **THEN** every control is disabled, read-only and required in the way its own prop
  makes it, and the Field's Label, Description and ErrorMessage carry the same data
  attributes

#### Scenario: Select trigger is a combobox (react-spectrum#8382)

- **WHEN** a Field around a Select displays an error
- **THEN** the trigger (role `combobox`) has `aria-invalid="true"`, its accessible
  description contains the error, and it carries `data-invalid` — react-spectrum#8382
  reports the missing `aria-invalid` on Select/ComboBox as a bug

#### Scenario: Plain button control

- **WHEN** a Field wraps a control whose focusable element has role `button`
- **THEN** that element has no `aria-invalid`, and the error is in its accessible
  description and `data-invalid`

### Requirement: Reporting Changes

A registered control SHALL report to its Field each value change it accepted, exactly
once per interaction, with the new value, the change's reason and whether it is
composing. It SHALL report a commit when the user confirms the value without changing it
(Enter in a single-line input, closing a Select). A change the control refused (disabled,
read-only, a controlled parent refusing) SHALL NOT be reported. A controlled value changed
by the parent SHALL be reported as a non-user change.

#### Scenario: One validation per toggle (base-ui#4902)

- **WHEN** a Checkbox inside a Field in `change` mode with a `validate` function is toggled
  once
- **THEN** `validate` runs once

#### Scenario: Read-only control and autofill (base-ui#4828)

- **WHEN** the browser autofills the hidden input of a read-only control inside a Field
  that shows a server error
- **THEN** the control's value is unchanged and the server error is still shown

### Requirement: Focus Target

The focus operation a control registers SHALL move focus to the element a user would fix:
the control's focusable element; in a group, its first invalid item, or else its tab stop
(the checked radio, or the first enabled item). It SHALL use the shared focus operation
with the modality it is given.

#### Scenario: Required checkbox in a group (base-ui#5200)

- **WHEN** a Checkbox Group whose second item is required and unchecked fails validation
  and the Field focuses its control
- **THEN** the second item's Control is focused

#### Scenario: Radio group is one stop (react-spectrum#3883)

- **WHEN** a required Radio Group with no selection is focused by its Field
- **THEN** its first enabled radio is focused

### Requirement: Field-Associated Trait

Contracts of form controls SHALL be able to declare the `field-associated` trait. For such
contracts, when the model-based runner renders the control inside a Field it SHALL check
after every step that the control is named by the Field's Label, that its
`aria-describedby` lists exactly the Field parts that are rendered, that `aria-invalid`
(where allowed) is present exactly when the Field displays invalid, and that the control's
disabled, read-only and required state matches the Field's props.

#### Scenario: Broken control ignores the Field

- **WHEN** a broken control variant does not read the Field's `disabled`
- **THEN** the first step after the Field is disabled fails, naming the trait

