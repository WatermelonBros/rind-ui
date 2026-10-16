## MODIFIED Requirements

### Requirement: Valued Trait Expectations

For contracts with the `valued` trait, the runner SHALL take the expected values from the
contract when it declares them (`valued: { values(view, props), valueText?(view, index, props) }`,
`props` being the oracle's props) and otherwise from the machine's `value`. The expected
values SHALL be a list, matched in DOM order to the elements that carry `aria-valuenow` or
represent a valued role (`slider`, `progressbar`, `meter`, `spinbutton`) and are not hidden
from assistive technology, so multi-thumb components are checked thumb by thumb. A `null`
entry SHALL require that element to have no `aria-valuenow`, and no `aria-valuetext` unless
the contract declares `valueText` for it (an empty Number Input says "Empty"). When the
contract declares `valueText`, each element's `aria-valuetext` SHALL equal it; otherwise a
numeric-looking value text SHALL be compared with the value only when it is the plain
`String(value)` form, so locale grouping such as "1.200" is never misread as 1.2.

#### Scenario: Multi-thumb mismatch

- **WHEN** a two-thumb slider's oracle values are `[20, 80]` and the second thumb has
  `aria-valuenow="79"`
- **THEN** the step fails naming the second thumb

#### Scenario: Indeterminate progress

- **WHEN** a progress oracle value is `null` and the root still carries `aria-valuenow`
- **THEN** the step fails naming the attribute

#### Scenario: Locale grouping

- **WHEN** a German-locale component shows `aria-valuetext="1.200"` for the value 1200
  and the contract declares no `valueText`
- **THEN** the step passes

#### Scenario: Empty number input

- **WHEN** a Number Input's oracle value is `null`, its input has no `aria-valuenow` and
  `aria-valuetext="Empty"`, and the contract declares `valueText` returning "Empty"
- **THEN** the step passes
