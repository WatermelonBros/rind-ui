## Purpose

Defines rind-ui's Switch: a two-state on/off control with `role="switch"`, its parts,
values, keyboard and ARIA behaviour, form participation, styling attributes, contract
and theme guarantees. Research: `docs/research/switch.md`.

## ADDED Requirements

### Requirement: Anatomy

A Switch SHALL consist of `Root` (provides the machine, renders a `div` by default and
renders the hidden form input of `hidden-form-input` as its last child), `Control` (a
`button-like-element` with `role="switch"`), `Thumb` (a decorative `span` inside the
Control), `Label` and `Description` (wired by `control-label`). `Thumb` SHALL carry
`aria-hidden="true"`. Every part SHALL accept the `render` prop; substituting the
Control's element SHALL keep its role, name, state and keyboard behaviour.

#### Scenario: Default markup

- **WHEN** a Switch with a Label "Wi-Fi" is rendered
- **THEN** there is exactly one element with role `switch` and accessible name "Wi-Fi",
  it is a native `button` with `type="button"`, and the hidden input after it is
  `aria-hidden` and not tabbable

#### Scenario: Name from a wrapping label (BU#4122)

- **WHEN** a consumer wraps a Switch without a Label part inside their own `<label>`
  containing "Dark mode"
- **THEN** the switch's accessible name is "Dark mode" and clicking the label text
  toggles it exactly once

### Requirement: Checked Value

The Switch SHALL expose a controllable boolean value `checked` with `defaultChecked`
(default `false`) and `onCheckedChange(checked, details)`, where `details.reason` is the
event that caused the change. The value SHALL be boolean only; there is no mixed state.
A change SHALL be reported during the interaction that caused it, and in uncontrolled
mode the Control's attributes and the hidden input SHALL already reflect the new value
when `onCheckedChange` runs.

#### Scenario: Uncontrolled toggle

- **WHEN** an uncontrolled Switch with `defaultChecked={false}` is pressed
- **THEN** `onCheckedChange(true, details)` is called once and the Control has
  `aria-checked="true"`

#### Scenario: Value reflected before the callback (HUI#3760)

- **WHEN** an uncontrolled Switch's `onCheckedChange` reads its form's `FormData`
- **THEN** the form data already contains the new value

#### Scenario: Controlled refusal

- **WHEN** a controlled Switch is pressed and the parent does not apply the proposed
  value
- **THEN** `aria-checked`, `data-state` and the hidden input keep the old value

### Requirement: ARIA Semantics

The Control SHALL have `role="switch"` and `aria-checked` set to exactly `"true"` or
`"false"`, never `"mixed"` and never absent. It SHALL carry `aria-readonly="true"` when
read-only, `aria-required="true"` when required and `aria-invalid="true"` when invalid.
Its accessible name SHALL come from the Label (or `aria-label` / `aria-labelledby` from
the consumer for an icon-only switch) and SHALL be identical in both states. The Switch
SHALL NOT render a live region; the state change is conveyed by `aria-checked` on the
focused Control.

#### Scenario: Name does not change with state

- **WHEN** a Switch labelled "Notifications" is toggled on and off
- **THEN** the accessible name is "Notifications" in both states and only
  `aria-checked` changes

#### Scenario: No announcement of our own

- **WHEN** a Switch is toggled
- **THEN** no announcement is sent to the Announcer and no `aria-live` region is
  rendered

### Requirement: Keyboard Interaction

With focus on the Control, Space SHALL toggle the switch once per key press, on key
release, with key repeat ignored. Enter SHALL NOT toggle the switch; when the Control
belongs to a form, Enter SHALL perform the form's implicit submission (as a native
checkbox does: activate the form's default submit button, if any). Tab and Shift+Tab
SHALL move focus to and from the Control. Nothing else is handled.

#### Scenario: Space toggles

- **WHEN** the Control is focused and the user presses and releases Space
- **THEN** the switch toggles once and the Control has `data-focus-visible`

#### Scenario: Held Space

- **WHEN** the user holds Space long enough for key repeat and releases it
- **THEN** the switch toggles exactly once

#### Scenario: Enter submits instead of toggling (ark#2946)

- **WHEN** a Switch inside a form with a submit button is focused and the user presses
  Enter
- **THEN** the switch keeps its value and the form is submitted

#### Scenario: Enter outside a form

- **WHEN** a Switch outside any form is focused and the user presses Enter
- **THEN** nothing happens

### Requirement: Pointer, Touch And Assistive Technology Activation

A press on the Control (mouse, pen, touch or a bare `click` from assistive technology)
SHALL toggle the switch exactly once, on release, through `press-interactions`; a press
moved off the Control before release SHALL NOT toggle. Pressing the Control SHALL focus
it without `data-focus-visible`. Clicking the Label SHALL toggle exactly once
(`control-label`).

#### Scenario: Activation on release (bits#789)

- **WHEN** the user presses the pointer on the Control, moves off it and releases
- **THEN** the switch does not toggle

#### Scenario: Screen-reader activation

- **WHEN** a screen reader activates the Control with a bare `click` (`detail: 0`, no
  pointer or key events)
- **THEN** the switch toggles exactly once

#### Scenario: Ancestor click handler runs once (zag#633)

- **WHEN** a controlled Switch sits inside a container with an `onClick` handler and the
  user clicks the Control
- **THEN** the container's handler runs exactly once

#### Scenario: Focus after click (kobalte#230)

- **WHEN** the user clicks the Control
- **THEN** the Control has focus and `data-focus`, and has no `data-focus-visible`

### Requirement: Disabled And Read-Only

A disabled Switch SHALL ignore every activation and follow `button-like-element` for
focusability (native `disabled`, or `aria-disabled` and tabbable with
`focusableWhenDisabled`); its hidden input SHALL be disabled, so it submits nothing. A
read-only Switch SHALL stay focusable, ignore every activation, keep submitting its
value and carry `aria-readonly="true"`.

#### Scenario: Read-only press

- **WHEN** a read-only Switch is clicked or receives Space
- **THEN** its value does not change, `onCheckedChange` is not called and it keeps
  focus

#### Scenario: Focusable when disabled (BU#5139)

- **WHEN** a disabled Switch with `focusableWhenDisabled` is reached with Tab and the
  user presses Space
- **THEN** it has focus, `aria-disabled="true"`, and its value does not change

### Requirement: Form Participation

The Switch SHALL participate in forms through `hidden-form-input` with `name`, `value`
(default `"on"`), `form`, `required` and `uncheckedValue`: a checked switch submits
`name=value`, an unchecked one submits nothing (or `name=uncheckedValue`). `name` SHALL
be set only on the hidden input, never on the Control. A form reset SHALL return the
switch to `defaultChecked` (uncontrolled) or propose it with reason `RESET`
(controlled). The hidden input SHALL NOT affect layout in either direction.

#### Scenario: Exactly one form entry (BU#2762)

- **WHEN** a checked Switch with `name="wifi"` is submitted
- **THEN** the form data has exactly one `wifi` entry with value `"on"` and the Control
  has no `name` attribute

#### Scenario: Reset (RX#3177)

- **WHEN** an uncontrolled Switch with `defaultChecked={false}` is toggled on and its
  form is reset
- **THEN** it is unchecked and `onCheckedChange(false, { reason: "RESET" })` was called

#### Scenario: Initial value is silent (RX#2419)

- **WHEN** a form listening for `change` renders a Switch with `defaultChecked`
- **THEN** no `change` event reaches the form until the user toggles the switch

#### Scenario: No scroll overflow in RTL (RX#4041, RX#3588)

- **WHEN** a Switch is rendered in a form inside a narrow scroll container with
  `dir="rtl"`
- **THEN** the container's scroll width equals its client width

#### Scenario: Control type is fixed (HUI#2935)

- **WHEN** a consumer passes `type="submit"` to the Control
- **THEN** a development warning names the Control and `type`, and pressing the switch
  toggles it

### Requirement: Data Attributes

Every part SHALL carry `data-scope="switch"`, its `data-part` (`root`, `control`,
`thumb`, `label`, `description`, `hidden-input`), `data-state="checked"` or
`data-state="unchecked"`, and, when applicable, `data-disabled`, `data-readonly`,
`data-required` and `data-invalid`. The Control SHALL also carry `data-focus`,
`data-focus-visible`, `data-pressed` (a press in progress) and `data-hover` per the
interaction modules.

#### Scenario: Styling the thumb

- **WHEN** a Switch is checked
- **THEN** the Root, Control, Thumb and Label all carry `data-state="checked"`

### Requirement: Contract

The Switch SHALL ship a contract with scope `switch`, anatomy `root`, `control`,
`thumb`, `label`, `description`, `hidden-input`, located by role `switch` and exact
accessible name, with:

- actions `toggle` (pointer: click the Control; touch: tap it; keyboard: Space on the
  Control; postcondition: `isChecked` flipped unless disabled or read-only),
  `clickLabel` (pointer: click the Label; keyboard: declared as none, reason "the Label
  has no keyboard path; keyboard users toggle the Control"), and `resetForm` (pointer:
  click the form's reset button; keyboard: Enter on it; postcondition: `isChecked`
  equals the default);
- queries `isChecked`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `name`
  (accessible name) and `formValue` (the submitted value, or `null` when nothing is
  submitted);
- states `unchecked` (`isChecked: false`) and `checked` (`isChecked: true`); events
  `TOGGLE` → `toggle`, `RESET` → `resetForm`;
- traits `form-associated`.

#### Scenario: Driver in both environments

- **WHEN** a test runs `getSwitch(screen, { name: "Wi-Fi" }).toggle()` and the same with
  a Playwright `page`
- **THEN** both resolve once `isChecked()` is `true`

#### Scenario: Keyboard twin

- **WHEN** a test runs `switch.via("keyboard").toggle()`
- **THEN** the Control receives Space and the switch toggles

### Requirement: Switch Invariants

The contract SHALL ship invariants checked after every model-test step: `aria-checked`
is `"true"` or `"false"` and matches the machine state; the accessible name is the same
in every state; the Thumb is `aria-hidden`; exactly one `TOGGLE` happened per activation
step.

#### Scenario: Mixed slips in

- **WHEN** a consumer wrapper renders `aria-checked="mixed"` on the Control
- **THEN** the step fails naming the Control and the attribute

#### Scenario: Label that changes (APG)

- **WHEN** a wrapper changes the Label text from "Mute" to "Unmute" when toggled
- **THEN** the step fails naming both names

### Requirement: Theme

`@rind-ui/theme`'s `switch.css` SHALL style the Switch only through its `data-*`
attributes and tokens, give the Control a target of at least 24×24 CSS px, show the
checked state with a non-colour cue (thumb position plus a border), keep the track and
thumb visible under `forced-colors: active`, place the checked thumb at the inline end
(left in RTL), and animate the thumb only through duration tokens.

#### Scenario: High contrast (ARK#3421)

- **WHEN** a checked and an unchecked Switch are rendered with forced colors emulated
- **THEN** both tracks and thumbs are visible and the thumbs are in different positions

#### Scenario: RTL thumb

- **WHEN** a checked Switch is rendered under `dir="rtl"`
- **THEN** its thumb is at the left end of the track

### Requirement: Field Control Binding

The Switch SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the Switch with that Field exactly once (id, labelable Control, focus
operation, the hidden input as validity element, a reader for `checked`), unregistering on
unmount.
The Field's ARIA SHALL be applied only to the registered Control: `aria-describedby`
with the Field's Description and, while rendered, ErrorMessage ids; `aria-invalid` (role
`switch` allows it) while the Field displays invalid; `aria-required` from the Field.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change exactly once (field-control "Reporting Changes"), register a focus
target that focuses the Control, declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Switch in an invalid, required Field

- **WHEN** a Switch with no props of its own is inside a Field with `required` that
  displays an error
- **THEN** its Control has `aria-required="true"` and `aria-invalid="true"`, its
  `aria-describedby` contains the ErrorMessage id, and its Root carries `data-required` and
  `data-invalid`

#### Scenario: Disabled Field

- **WHEN** a Switch is inside a disabled Field
- **THEN** it is disabled exactly as its own `disabled` prop makes it, and its hidden input
  is disabled
