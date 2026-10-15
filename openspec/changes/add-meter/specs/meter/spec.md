## Purpose

Defines rind-ui's Meter: a display of a scalar measurement within a known range, with
`role="meter"`, optional low/high/optimum regions, value text, styling attributes,
contract and theme. Research: `docs/research/meter.md`.

## ADDED Requirements

### Requirement: Anatomy

A Meter SHALL consist of `Root` (a `div` with `role="meter"`), `Label` (a `span`),
`ValueText` (a `span` with `aria-hidden="true"`, default content the value text), `Track`
and `Indicator`. Every part SHALL accept the `render` prop.

#### Scenario: Default markup

- **WHEN** a Meter with Label "Storage" and value 75 is rendered
- **THEN** exactly one element has role `meter`, named "Storage", with
  `aria-valuenow="75"`

### Requirement: Value

Meter SHALL take a required `value: number`, `min` (default 0) and `max` (default 100),
normalised by `range-value`. A `null` or missing value SHALL be a development error and
render as `min`; a Meter is never indeterminate.

#### Scenario: Missing value

- **WHEN** a Meter is rendered without `value`
- **THEN** a development error is reported and `aria-valuenow` equals `min`

### Requirement: ARIA Semantics And Name

Root SHALL carry exactly `role="meter"` (no fallback tokens), the value attributes of
`range-value`, and `aria-labelledby` pointing at the Label while it is rendered; a
consumer `aria-label` or `aria-labelledby` SHALL be used as given and the value text
SHALL never be the name. A Meter with no name SHALL cause a development error unless Root
is `aria-hidden`. Root SHALL contain the same visually hidden filler span as Progress,
under the quirk entry `nvda-progressbar-name`.

#### Scenario: No role fallback (RS#6627, RS#10737)

- **WHEN** a Meter is checked with axe
- **THEN** its `role` attribute is exactly `meter` and axe reports no
  `aria-allowed-attr` violation

#### Scenario: NVDA name (BU#4184)

- **WHEN** a Meter labelled "Storage" is rendered
- **THEN** Root contains the filler span

### Requirement: Regions

When any of `low`, `high` or `optimum` is set, the Meter SHALL compute its region as the
HTML `<meter>` element does: `low` clamped to `[min, max]` (default `min`), `high`
clamped to `[low, max]` (default `max`), `optimum` clamped to `[min, max]` (default the
midpoint); the region that contains `optimum` is `optimum`, a region adjacent to it is
`suboptimum` and the region on the far side is `even-less-good`. The region SHALL be
exposed as `data-zone` on every part and passed to `messages.valueText` as `zone`. When
none of the three is set, no part SHALL carry `data-zone`.

#### Scenario: Battery, higher is better

- **WHEN** `low={20}`, `high={80}`, `optimum={100}` and the value is 10
- **THEN** every part has `data-zone="even-less-good"`

#### Scenario: Middle value

- **WHEN** `low={20}`, `high={80}`, `optimum={100}` and the value is 50
- **THEN** every part has `data-zone="suboptimum"`

#### Scenario: Zone spoken through the value text (BU#1434)

- **WHEN** `messages.valueText` returns `${formatted}, low` for the `even-less-good` zone
- **THEN** `aria-valuetext` is "10%, low"

#### Scenario: No thresholds

- **WHEN** none of `low`, `high`, `optimum` is set
- **THEN** no part has `data-zone`

### Requirement: Value Text And Fill

`aria-valuetext` and the default content of `ValueText` SHALL be the value text of
`range-value` through `messages.valueText({ value, percent, formatted, zone })`. The
Indicator SHALL carry `--rind-meter-percent` and an inline size of that percent along
its orientation, including `0%`.

#### Scenario: Unclamped text (BU PR#5409)

- **WHEN** `value` is 130 with `max` 100 and `formatOptions={{ style: "unit", unit: "percent" }}`
- **THEN** the value text shows 100, not 130

### Requirement: Not A Live Region

No part of a Meter SHALL be a live region, and the Meter SHALL make no announcements.

#### Scenario: Live value

- **WHEN** a Meter's value changes every second
- **THEN** no element of it has `aria-live` and nothing is announced

### Requirement: Data Attributes

Every part SHALL carry `data-orientation` and, when regions are set, `data-zone`; Root
SHALL carry `data-value`, `data-min` and `data-max`. `data-variant`, `data-size` and
`data-tone` SHALL pass through untouched.

#### Scenario: Root data

- **WHEN** a Meter with value 3, min 0 and max 5 is rendered
- **THEN** Root has `data-value="3"`, `data-min="0"`, `data-max="5"`

### Requirement: Contract

The meter contract SHALL locate an instance by role `meter` and exact name, declare no
user actions, the queries `value()`, `valueText()`, `percent()`, `zone()` and `name()`,
prop steps for value changes, and the trait `valued` with `values(view)` from the
normalised value.

#### Scenario: Driver reads the zone

- **WHEN** `getMeter(screen, { name: "Battery" }).zone()` runs on a Meter at 10 with the
  thresholds above
- **THEN** it returns `"even-less-good"`

### Requirement: Theme

`meter.css` SHALL style the Meter on data attributes and `--rind-meter-*` tokens: the fill
from `--rind-meter-percent`; the `suboptimum` and `even-less-good` zones mapped to the
warning and danger palettes, each with a non-colour cue (pattern or edge) so a zone is
never shown by colour alone; under `forced-colors: active` a `Highlight` fill and a
`CanvasText` track edge, with zones still distinguishable. It SHALL style its theme
family's `data-variant` and `data-size`.

#### Scenario: Zone without colour

- **WHEN** a Meter in the `even-less-good` zone is rendered under forced colors
- **THEN** its zone is still distinguishable from the `optimum` zone
