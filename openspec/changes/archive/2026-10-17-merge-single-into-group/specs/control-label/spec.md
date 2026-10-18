## MODIFIED Requirements

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
