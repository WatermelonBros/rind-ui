# radio-group Specification

## Purpose
Defines the Radio Group component (APG Radio Group pattern): a named group of radios of
which at most one is checked, where arrow keys move and check, focus alone never checks,
the group is one tab stop, the value takes part in forms like native radios, and a
contract lets drivers check and read radios in any test environment.
## Requirements
### Requirement: Anatomy

Radio Group SHALL consist of a `root` part, optional `label`, `description` and
`error-message` parts, and per radio an `item` part containing an `item-control` part and
optional `item-indicator`, `item-label` and `item-description` parts. Items SHALL be
paired with their state by a `value` key and SHALL register as static collection items
(`add-collections`). The item control SHALL be a button-like element (`add-button`
`button-like-element`) with `role="radio"`. Each item SHALL render its hidden form input
(`add-checkbox` `hidden-form-input`) as a sibling of the control, never inside it. The
item label and description SHALL be wired by `add-checkbox` `control-label`. The item
indicator SHALL be decorative (`aria-hidden="true"`) and mounted only while its radio is
checked. Every part SHALL accept the `render` prop.

#### Scenario: Hidden input is not nested (reka-ui#1597)

- **WHEN** a Radio Group with `name="size"` renders three items
- **THEN** no `input` element is a descendant of an element with `role="radio"`, and axe
  reports no nested-interactive violation

#### Scenario: Arrows ignore other focusables (react-spectrum#2379, react-spectrum#6496)

- **WHEN** an item contains a link and the user presses ArrowDown on the previous radio
- **THEN** focus moves to the next radio control, never to the link

### Requirement: Value

Radio Group SHALL have a controllable value `value: string | null` (`value`,
`defaultValue`, `onValueChange(value, details)`), defaulting to `null`. At most one radio
SHALL be checked. A user action SHALL never uncheck the checked radio: pressing a checked
radio again SHALL change nothing and SHALL NOT call `onValueChange`. `details.reason`
SHALL be the event that caused the change (`NAVIGATE` or `PRESS`), and `details.cancel()`
SHALL veto it.

#### Scenario: Pressing the checked radio (react-spectrum#4971, radix#1336)

- **WHEN** the checked radio "M" is clicked
- **THEN** "M" stays checked and `onValueChange` is not called

#### Scenario: Programmatic clear

- **WHEN** a controlled parent passes `value={null}` after "M" was checked
- **THEN** no radio is checked and every radio has `aria-checked="false"`

### Requirement: Keyboard And Activation

ArrowDown and ArrowRight SHALL move focus to the next enabled radio and ArrowUp and
ArrowLeft to the previous one, whatever the `orientation`, wrapping at both ends; under
`dir="rtl"` ArrowLeft and ArrowRight SHALL be mirrored. Unless the group is read-only, a
keyboard move SHALL check the newly focused radio in the same step, through the
keyboard-modality guard of `add-a11y-foundations`. Space SHALL check the focused radio; a
pointer or touch release over an item, a press on its label, and an assistive-technology
`click` with no preceding pointer or key events SHALL check that radio, exactly once per
activation. Enter SHALL NOT check a radio; it SHALL perform the form's implicit
submission as `hidden-form-input` specifies. A `focus` event alone — programmatic,
screen-reader cursor, dialog initial focus or pointer down — SHALL NOT check a radio.
Arrow keys with Alt, Control or Meta and key events marked `composing` SHALL do nothing.
Home, End and printable characters SHALL do nothing.

#### Scenario: Arrow moves and checks

- **WHEN** "S" is checked and focused and the user presses ArrowDown
- **THEN** "M" is focused and checked in the same step and `onValueChange("M")` is called
  with `reason: "NAVIGATE"`

#### Scenario: Orientation does not disable arrows (radix#3622)

- **WHEN** a group with `orientation="horizontal"` has focus on "S" and the user presses
  ArrowDown
- **THEN** "M" is focused and checked

#### Scenario: Programmatic focus does not check (radix#938, bits-ui#1198)

- **WHEN** consumer code or a dialog's initial focus moves focus to the unchecked radio
  "L" with no key event
- **THEN** "L" is focused and the value does not change

#### Scenario: Pointer down does not check (bits-ui#2097)

- **WHEN** the user presses the pointer down on the unchecked radio "L" while "S" is
  checked, moves off and releases outside
- **THEN** the value stays "S"

#### Scenario: Ignored arrow arms nothing (base-ui#5626)

- **WHEN** the user presses Control+ArrowDown on a radio, then clicks elsewhere and tabs
  back into the group
- **THEN** the value does not change

#### Scenario: Fast arrows (radix#4094)

- **WHEN** ArrowDown is pressed twice faster than focus can move, starting on "S"
- **THEN** "L" is focused and checked

#### Scenario: Space with nothing checked (base-ui#5042)

- **WHEN** no radio is checked, the user tabs into the group and presses Space
- **THEN** the first radio is checked

#### Scenario: Enter submits instead of checking (headlessui#394)

- **WHEN** the unchecked focused radio "L" receives Enter inside a form with a submit
  button
- **THEN** the form's `submit` event fires once and the value does not change

#### Scenario: Screen-reader activation

- **WHEN** a screen reader activates radio "L" with a bare `click`
- **THEN** "L" is checked exactly once with `modality: "virtual"`

#### Scenario: RTL

- **WHEN** ArrowLeft is pressed on "S" under `dir="rtl"`
- **THEN** "M" is focused and checked

### Requirement: Tab Stop And Focus

The group SHALL be exactly one Tab stop, following `add-collections`: the focused radio
while focus is inside; else the checked radio if it is enabled; else the first enabled
radio; else, when every item is disabled but the group is not, the root itself. When
the group is disabled (and not `focusableWhenDisabled`), nothing in it SHALL be a Tab
stop, as with native disabled radios; with `focusableWhenDisabled` the root is the stop
and carries `aria-disabled="true"`. Before items register
(server render), the item whose value equals the selected value SHALL have `tabIndex=0`,
else the first item rendered. Clicking an item or its label SHALL focus its control. The
hidden form inputs SHALL never receive focus from rind-ui; when the browser focuses one
for constraint validation, focus SHALL move to the visible control as
`hidden-form-input` specifies.

#### Scenario: Nothing checked (headlessui#378)

- **WHEN** no radio is checked and the user presses Tab into the group
- **THEN** the first enabled radio is focused and nothing is checked

#### Scenario: Checked radio is the stop (base-ui#1740)

- **WHEN** "L", the third radio, is checked and the user tabs into the group from above
- **THEN** "L" is focused

#### Scenario: Checked radio disabled (bits-ui#1568)

- **WHEN** the checked radio is disabled and the user tabs into the group
- **THEN** the first enabled radio is focused and the group is operable

#### Scenario: Disabled group (base-ui#4174)

- **WHEN** the group is disabled and the user presses Tab through the page
- **THEN** focus skips the group entirely and no radio can be focused or checked

#### Scenario: Disabled but discoverable

- **WHEN** the group is disabled with `focusableWhenDisabled` and the user tabs into it
- **THEN** focus stops once on the root, announced as a disabled radio group, and no
  radio can be checked

#### Scenario: Server render (base-ui#5597)

- **WHEN** a group with `defaultValue="M"` and a Label is rendered on the server
- **THEN** the HTML has the root labelled by the label's id, radio "M" with `tabIndex=0`
  and the other radios with `tabIndex=-1`

#### Scenario: Click keeps keyboard operation (kobalte#230)

- **WHEN** the user clicks the label of radio "M" and then presses ArrowDown
- **THEN** "M" was checked and focused by the click, and ArrowDown checks the next radio

#### Scenario: No scroll jump on click (zag#3239, ark#1502)

- **WHEN** the group is inside a scrolled container and the user clicks a fully visible
  item
- **THEN** neither the page nor the container scrolls

### Requirement: Disabled, Read-Only, Required And Invalid

A disabled item SHALL carry `aria-disabled="true"` (native `disabled` on the control
unless `focusableWhenDisabled`), SHALL be skipped by arrow keys and SHALL never be checked
by a user action. A `disabled` root SHALL disable every item and carry
`aria-disabled="true"`; a disabled ancestor `fieldset` SHALL disable the group. A
`readOnly` group SHALL carry `aria-readonly="true"`, SHALL stay focusable and navigable
with arrows, and no key, press or label click SHALL change its value. A `required` group
SHALL carry `aria-required="true"` on the root and SHALL make its hidden inputs
`required`, so native validation fails while nothing is checked. An `invalid` group SHALL
carry `aria-invalid="true"` on the root and reference the error message through
`aria-describedby`; `required` alone SHALL NOT set `aria-invalid`.

#### Scenario: Read-only (zag#2675, react-spectrum#9425)

- **WHEN** a read-only group has "S" checked and the user presses ArrowDown, Space, and
  clicks "L"
- **THEN** focus moves to "M" on ArrowDown, the value stays "S", and `onValueChange` is
  never called

#### Scenario: Required is exposed (radix#1413, base-ui#2226)

- **WHEN** a group is rendered with `required`
- **THEN** the root has `aria-required="true"` and each hidden input has `required`

#### Scenario: Required is not invalid before interaction (react-spectrum#9809)

- **WHEN** a required group with nothing checked renders and the consumer has not set
  `invalid`
- **THEN** neither the root nor any radio has `aria-invalid`

#### Scenario: Disabled fieldset (headlessui#1802)

- **WHEN** the group is inside `<fieldset disabled>`
- **THEN** every radio behaves as disabled and the hidden inputs submit nothing

### Requirement: Roles And Names

The root SHALL have role `radiogroup`, `aria-orientation` from `orientation` (default
`vertical`; it SHALL affect only this attribute and `data-orientation`) and a name from
`aria-labelledby` pointing at the `label` part (rendered as a non-`label` element, since
`radiogroup` is not labelable) or from `aria-label`; without either a development warning
SHALL name the root. The `description` part SHALL be referenced by the root's
`aria-describedby`. Each control SHALL have `aria-checked` set explicitly to `"true"` or
`"false"` and a name from its item label; the name SHALL never fall back to the item's
value. The hidden inputs SHALL be `aria-hidden="true"` and `tabIndex=-1`, so assistive
technology sees exactly one radio per item.

#### Scenario: Count is right (radix#1694)

- **WHEN** a group of four radios is inspected in the accessibility tree
- **THEN** it contains exactly four `radio` nodes, and VoiceOver can announce "1 of 4"

#### Scenario: Name from label, not value (reka-ui#2860)

- **WHEN** an item with value `"m"` has the label "Medium"
- **THEN** its control's accessible name is "Medium"

#### Scenario: Located by role and name (ark#3792)

- **WHEN** a test queries `getByRole("radio", { name: "Medium" })`
- **THEN** exactly the visible control of that item matches

### Requirement: Form Participation

Radio Group SHALL take part in forms through `hidden-form-input` with one hidden
`input[type="radio"]` per item, all sharing `name` (default derived from the root id, so
two groups never form one browser group) and `form`, each with its item's value and
`checked` mirroring the selection. A form submitted with nothing checked SHALL contain no
entry for the name, like native radios. A form reset SHALL restore the `defaultValue`
(uncontrolled) or call `onValueChange` with `reason: "RESET"` (controlled). Disabled items
and disabled groups SHALL submit nothing.

#### Scenario: Native form data (base-ui#2447, base-ui#3338)

- **WHEN** a form containing a group `name="size"` with nothing checked is submitted, and
  then again with "M" checked
- **THEN** the first form data has no `size` entry and the second has exactly
  `size=m`

#### Scenario: Form reset (headlessui#2851, bits-ui#1942)

- **WHEN** an uncontrolled group with `defaultValue="s"` has "L" checked and its form is
  reset
- **THEN** "S" is checked again and its hidden input is checked

#### Scenario: Invalid submit focuses the control (bits-ui#1727)

- **WHEN** a required group with nothing checked is submitted
- **THEN** submission is blocked, the first enabled radio control receives focus, and no
  "aria-hidden element retained focus" warning occurs

#### Scenario: Two groups without names (ariakit#3833)

- **WHEN** two groups without `name` are rendered in one form
- **THEN** checking a radio in one group leaves the other group's value unchanged

### Requirement: Announcements

Radio Group SHALL NOT announce through the Announcer or render a live region: the checked
state is conveyed by `aria-checked` on the focused radio.

#### Scenario: Arrowing

- **WHEN** the user arrows from "S" to "M"
- **THEN** no Announcer message is recorded

### Requirement: Data Attributes

Every part SHALL carry `data-scope="radio-group"` and its `data-part` (`root`, `label`,
`description`, `error-message`, `item`, `item-control`, `item-indicator`, `item-label`,
`item-description`). The root SHALL carry `data-orientation`, and `data-disabled`,
`data-readonly`, `data-required` and `data-invalid` when those states hold. The item,
item control, item indicator and item label SHALL carry `data-key`,
`data-state="checked|unchecked"`, and `data-disabled`, `data-readonly` and `data-invalid`
when those states hold; the item control SHALL also carry `data-highlighted` when it is
the roving focus target and the `button-like-element` attributes `data-focus`,
`data-focus-visible`, `data-pressed` and `data-hover`, which the item and item label SHALL
mirror. Every attribute SHALL change in the same step as the state.

#### Scenario: Focus-visible while arrowing (zag#2629)

- **WHEN** the user arrows from "S" to "M"
- **THEN** the control of "M" has `data-focus-visible` and the control of "S" does not

#### Scenario: Checked and disabled

- **WHEN** "M" is checked and "L" is disabled
- **THEN** "M"'s item, control and label have `data-state="checked"` and "L"'s have
  `data-state="unchecked"` and `data-disabled`

### Requirement: Contract

Radio Group SHALL ship a contract with scope `radio-group`, anatomy matching the parts,
located by role `radiogroup` and exact accessible name. Actions: `check(name)` — pointer
and touch: press the radio named `name`; keyboard: focus the group and press ArrowDown
until that radio is checked; completes when `checked()` equals `name`. Queries: `radios()`
(accessible names in order), `checked()` (name of the radio with `aria-checked="true"`, or
null), `focusedRadio()`, `isDisabled(name)`, `isReadOnly()`, `isRequired()`, `isInvalid()`
and `formValue()` (the entries the owning form would submit for the group's name).
Traits: `composite-roving`, `selectable` and `directional`. Focus SHALL change only the focus
state and the focused-item query, never the value; the contract declares the item as
committing on focus for that reason, and the value is checked by the `form-associated` trait
after every step. A generated driver `getRadioGroup(target, { name })` SHALL be exported
from `@rind-ui/testing`.

#### Scenario: Same test in both environments

- **WHEN** a test calls `getRadioGroup(screen, { name: "Size" }).check("Large")` and then
  the same with a Playwright `page`
- **THEN** both resolve once "Large" is checked and `formValue()` returns `[["size", "l"]]`

#### Scenario: Model-based run

- **WHEN** `testMachine(radioGroupContract, …)` runs with argument classes for no value,
  first item disabled, checked item disabled, all disabled, read-only, required and both
  directions
- **THEN** every transition runs in the pointer, touch, keyboard and virtual modalities
  with every generic and trait invariant checked after each step

### Requirement: Theme

`@rind-ui/theme` SHALL style Radio Group through data attributes only: a checked cue that
is a `currentColor` or system-colour glyph (not a background alone), a ring visible under
`forced-colors: active` (`ButtonText` ring, `Highlight` dot, `GrayText` when disabled),
an item hit area of at least 24×24 CSS px, and the shared focus ring on the control's
`data-focus-visible`.

#### Scenario: High contrast (radix#2993, react-spectrum#4151)

- **WHEN** a checked and an unchecked radio are rendered with forced colors emulated
- **THEN** both are visible and distinguishable

### Requirement: Field Control Binding

The Radio Group SHALL implement add-field's `field-control` binding. Its Root SHALL read the
nearest Field's binding and register the group with that Field exactly once as one control (non-labelable group
root, focus operation, a validity element, a reader for the value), unregistering on
unmount. Its items SHALL NOT register and SHALL keep their own ids (base-ui#4121).
The Field's ARIA SHALL be applied only to the registered group root: named by the
Field's Label through `aria-labelledby`; `aria-describedby` with the Field's Description
and, while rendered, ErrorMessage ids; `aria-invalid` (role `radiogroup` allows it) while
the Field displays invalid; `aria-required` from the Field. The group's own
`error-message` part SHALL remain usable outside a Field and SHALL defer to the Field's
ErrorMessage inside one.
Its `disabled`, `readOnly`, `required` and `invalid` SHALL be OR-merged with the Field's
and an enclosing Fieldset's (field-control "State Propagation"). It SHALL report each
accepted change exactly once (field-control "Reporting Changes"), register a focus
target that moves focus to the checked radio, or else the first enabled radio (react-spectrum#3883), declare the `field-associated` trait, and add the Field prop × control
matrix test.

#### Scenario: Radio Group in a Field (base-ui#4121)

- **WHEN** a Radio Group with three items is inside a required Field that displays an error
- **THEN** only the group registers, the three item ids are distinct, the root is named by
  the Field's Label and has `aria-invalid="true"` and `aria-required="true"`, and no item
  carries the Field's `aria-describedby` ids

#### Scenario: Read-only Field

- **WHEN** a Radio Group is inside a read-only Field and the user presses ArrowDown
- **THEN** focus moves but the value does not change, as with its own `readOnly`

### Requirement: Hosted By A Toolbar

When a `CompositeHost` (add-toolbar's `composite-host` capability) is present, the Radio
Group SHALL run in hosted mode instead of the standalone keyboard and tab-stop rules:
its radios SHALL register with the host and join the host's roving focus in document
order; the group SHALL render no tab stop of its own (no fallback `tabIndex` on the root)
and SHALL handle no arrow, Home or End keys; the host's `disabled` and
`focusableWhenDisabled` SHALL apply to its radios. It SHALL keep role `radiogroup`, its
`radio` items, `aria-checked`, its name, its value and its change callbacks. A hosted
radio group SHALL never check a radio on arrow movement or focus; Space and Enter SHALL
check the focused radio (Enter does not submit the form while hosted). A radio group
inside a popup or portal opened from a host control SHALL be standalone.

#### Scenario: Arrows only move inside a toolbar (regression: radix-ui/primitives#2146, kobaltedev/kobalte#579)

- **WHEN** "Left" is checked in an alignment radio group inside a toolbar and the user
  presses ArrowRight twice from "Left"
- **THEN** focus is on "Right", "Left" is still checked and no change callback fired;
  pressing Enter then checks "Right" once

#### Scenario: No own tab stop when hosted

- **WHEN** a toolbar holds a button and a hosted radio group with three radios
- **THEN** exactly one of the four controls has `tabIndex=0`, and the group root has no
  `tabIndex`

