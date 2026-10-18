# control-label Specification

## Purpose
Defines the Label and Description parts that name and describe a labelable rind-ui control
(the Checkbox and Switch controls, Checkbox Group items and, later, Radio items). It covers
how a label click activates the control exactly once and without a focus ring, whether the
label is rind-ui's part, a consumer `<label for>` or a wrapping `<label>`. Shared by every
component with a labelable control; introduced by `add-checkbox`.
## Requirements
### Requirement: Label Names The Control

A component's `Label` part SHALL render a `<label>` whose `for` is the control's id when the
rendered control element is labelable (a native `<button>` or `<input>`). The control's
accessible name SHALL then come from the label natively, with no `aria-labelledby` added.
A control wrapped in a consumer's `<label>`, or referenced by a consumer's `<label for>`,
SHALL get its name the same native way. A consumer `aria-label` or `aria-labelledby` on the
control SHALL be used as given and SHALL NOT be combined with a label's text into a second
copy of the name. When no Label part is rendered, the control SHALL reference no label id.

#### Scenario: Name from the Label part

- **WHEN** a Checkbox renders a Label with the text "Accept terms"
- **THEN** its control's accessible name is "Accept terms" and the control has no
  `aria-labelledby`

#### Scenario: Wrapped in a consumer label (base-ui#4122)

- **WHEN** a consumer renders `<label><CheckboxGroup.Item>…</CheckboxGroup.Item> Accept terms</label>`
  with no Label part
- **THEN** the control's accessible name is "Accept terms"

#### Scenario: No doubled name (base-ui#5786)

- **WHEN** a control with `aria-label="lease.pdf"` is wrapped in a `<label>` whose text is
  "lease.pdf"
- **THEN** its accessible name is "lease.pdf", not "lease.pdf lease.pdf"

#### Scenario: Label not rendered (ark#3824)

- **WHEN** a Checkbox is named only by `aria-label` and renders no Label
- **THEN** no element of the component carries an `aria-labelledby` or `for` that points
  at a missing id

### Requirement: One Activation Per Label Click

A pointer click on the Label part, on a consumer `<label for>` or on a consumer `<label>`
wrapping the component SHALL activate the control exactly once, through the browser's own
label activation of the labelable control. The Label part SHALL have no activation handler
of its own while the control is labelable. The hidden form input SHALL never be the label's
target. A click on a label of a disabled or read-only control SHALL NOT change its value.

#### Scenario: Plain label around a controlled checkbox (radix#512)

- **WHEN** a controlled Checkbox wrapped in a plain `<label>` is clicked repeatedly on its
  Indicator, its Control and the label text
- **THEN** each click toggles the value exactly once and the Checkbox never gets stuck

#### Scenario: Label click toggles once (bits-ui#1670, zag#625, bits-ui#787)

- **WHEN** the user clicks the Label part once
- **THEN** the value changes once, one change is proposed, and the hidden input dispatches
  one `change`

#### Scenario: Consumer label after an outside double click (zag#515)

- **WHEN** the user double-clicks outside the component and then clicks its label
- **THEN** the value changes once

### Requirement: Label Activation Is A Pointer Press

An activation that a label click forwards to the control SHALL be classified as a pointer
press (modality `pointer`), not a virtual one, even though the control itself saw no
`pointerdown`. After a label click the control SHALL have focus and `data-focus`, and SHALL
NOT carry `data-focus-visible`.

#### Scenario: No ring after a label click (react-spectrum#10299, react-spectrum#3675, kobalte#39)

- **WHEN** the user clicks a Checkbox's Label with a mouse, including inside an element
  with a `tabIndex` and inside a popover
- **THEN** the control is focused, carries `data-focus` and does not carry
  `data-focus-visible`

#### Scenario: Keyboard after a label click (kobalte#230)

- **WHEN** the user clicks the Label and then presses Space
- **THEN** the value changes twice in total: once for the click and once for Space

### Requirement: Non-Labelable Control Fallback

When the control is substituted by an element that is not labelable (for example a `<div>`
through `render`), the Label part SHALL render without `for`. The control SHALL carry
`aria-labelledby` pointing at the Label, and a pointer press on the Label SHALL activate the
control exactly once and focus it, with the same modality rule as a native label
activation.

#### Scenario: Div control (headlessui#3876)

- **WHEN** a Checkbox's Control is rendered as a `<div>` and its Label is clicked
- **THEN** the value changes once, the Label has no `for` attribute, and the control's
  accessible name is the Label's text

### Requirement: Description

A component's `Description` part SHALL be referenced from the control's `aria-describedby`
only while it is rendered. Ids that the consumer passes in `aria-describedby`, or that a
group adds, SHALL be kept alongside it.

#### Scenario: Description appears later

- **WHEN** a Checkbox renders its Description only after a toggle
- **THEN** before the toggle the control has no `aria-describedby`, and afterwards its
  accessible description is the Description's text

#### Scenario: Consumer ids kept

- **WHEN** the consumer passes `aria-describedby="hint"` and a Description is rendered
- **THEN** the control's `aria-describedby` contains both `hint` and the Description's id

### Requirement: Label And Description Mirror State

The Label and Description parts SHALL carry the control's state attributes (`data-state`,
`data-disabled`, `data-readonly`, `data-required`, `data-invalid`) so they can be styled
with the control.

#### Scenario: Disabled label

- **WHEN** a Checkbox is disabled
- **THEN** its Label and Description carry `data-disabled`

### Requirement: Label Interaction

A component's `Label` part SHALL follow the shared `label-interaction` capability
(`add-label`) instead of rules of its own: the Double-Click Selection Guard (only a
`mousedown` whose `detail` is greater than 1 is cancelled, never a single one), Clicks
Pass Through (the Label never cancels a `click`), no `for` attribute when the control is
not labelable, and the Development Warnings. In the non-labelable fallback the Label's
press SHALL focus the control through `label-interaction`'s focus forwarding (modality
`pointer`) and, unlike a plain focus-forwarding label, still activate the control exactly
once (Non-Labelable Control Fallback). Existing scenarios are unchanged.

#### Scenario: Double click on a Checkbox label (radix#2656)

- **WHEN** the user double-clicks the text of a Checkbox's Label
- **THEN** no text is selected and the value changes twice, once per click, as with a
  native label

#### Scenario: Link inside a control label (headlessui#3658)

- **WHEN** a Checkbox's Label contains a link and the user clicks the link
- **THEN** the link navigates and the Checkbox does not toggle

### Requirement: Field As Label And Description Source

When the component's control is registered with an enclosing Field (`field-control`,
`add-field`), the Field SHALL be its label and description source: `Label Names The
Control` SHALL use the Field's Label (by `for` for a labelable control, by
`aria-labelledby` otherwise), and the control's `aria-describedby` SHALL list the Field's
Description id and, while it is rendered, the Field's ErrorMessage id, before the
control's own Description id and the consumer's ids (field-control "Description And Error
Wiring"). A component's own Label part rendered inside a Field SHALL produce a
development warning, and the Field's Label SHALL name the control. Outside a Field the
component's own Label and Description apply unchanged.

#### Scenario: Checkbox inside a Field

- **WHEN** a Checkbox without its own Label is inside a Field with Label "Accept terms" and
  Description "Required to continue", and the user clicks the Field's Label once
- **THEN** the control's accessible name is "Accept terms", its accessible description is
  "Required to continue", and the value changes once

#### Scenario: Own Label inside a Field

- **WHEN** a Checkbox renders its own Label part inside a Field that has a Label
- **THEN** a development warning is emitted and the control is named by the Field's Label

