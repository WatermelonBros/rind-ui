# range-value Specification

## Purpose
Defines the machine-less value model shared by rind-ui's value displays (Progress and
Meter): how a value, a range and format options become one normalised value, a percent,
a value text and ARIA value attributes, so every output of a component comes from the
same numbers.
## Requirements
### Requirement: One Normalised Value

The model SHALL derive, as a pure function of `{ value, min, max }`, one clamped value in
the consumer's units, a fraction and a percent, and every output of a component using it
(ARIA attributes, value text, fill size, custom properties, data attributes) SHALL be
computed from that result. `null` and `undefined` SHALL mean indeterminate; any number,
including 0, SHALL be determinate. A value outside the range SHALL be clamped with a
development warning, never turned indeterminate. `min ≥ max` or a non-finite bound SHALL
log a development warning and yield fraction 0; no output SHALL contain `NaN`.

#### Scenario: Custom range (BU PR#5095)

- **WHEN** `min` is 20, `max` is 40 and `value` is 30
- **THEN** the percent is 50, `aria-valuenow` is 30, and the default value text is "50%"

#### Scenario: Zero is a value (RK#910, BU#1203)

- **WHEN** `value` is 0
- **THEN** the result is determinate with percent 0, and the fill size is `0%`

#### Scenario: Empty range (RS#10042)

- **WHEN** `min` and `max` are both 0 and `value` is 0
- **THEN** the percent is 0, no output contains `NaN`, and a development warning names
  the range

#### Scenario: Out of range

- **WHEN** `value` is 120 with `max` 100
- **THEN** `aria-valuenow` is 100 and a development warning names the value

### Requirement: Value Text

The value text SHALL be formatted with the component's locale through the shared number
formatting of `i18n-messages`: with `formatOptions` of style `percent` (the default) the
fraction is formatted, otherwise the clamped value. The result SHALL then pass through
the component's `messages.valueText`, which receives the value, the percent and the
formatted string. Visible value text and `aria-valuetext` SHALL be the same string.

#### Scenario: Units

- **WHEN** `formatOptions` is `{ style: "unit", unit: "gigabyte" }`, locale `en-US` and
  value 75
- **THEN** the value text is "75 GB"

#### Scenario: Same text on server and client (BU#4616)

- **WHEN** a component is rendered on the server and hydrated under a provider with
  locale `fr-FR`
- **THEN** both renders produce the same value text and hydration reports no mismatch

### Requirement: Value Attributes

The model SHALL produce `aria-valuemin`, `aria-valuemax`, and, only when determinate,
`aria-valuenow` (the clamped value, never the percent) and `aria-valuetext`. It SHALL
never produce an `aria-label`.

#### Scenario: Indeterminate attributes (RK#1871)

- **WHEN** the value is `null`
- **THEN** there is no `aria-valuenow`, no `aria-valuetext` and no `aria-label`

#### Scenario: Value in user units (BU#2263)

- **WHEN** `max` is 200 and `value` is 50
- **THEN** `aria-valuenow` is 50, not 25

