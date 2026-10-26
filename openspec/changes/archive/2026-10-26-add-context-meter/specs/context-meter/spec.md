## ADDED Requirements

### Requirement: Context Meter Anatomy

A Context Meter SHALL consist of a `Root` with optional `Label`, `ValueText`, `Track`,
`Indicator`, `Breakdown` and `BreakdownItem`. With a known `max`, the Root SHALL have
`role="meter"`, `aria-valuemin="0"`, `aria-valuemax` = `max`, `aria-valuenow` = `min(used, max)`
and `aria-valuetext`, and SHALL be named by the Label or `messages.label`. `ValueText`, `Track`
and `Indicator` SHALL be `aria-hidden`.

#### Scenario: A meter, not a progress bar (regression: AI Elements)

- **WHEN** a Context Meter with `used` 21400 and `max` 128000 is rendered
- **THEN** one element has `role="meter"` and its value text contains "17%"

### Requirement: Context Meter States

The state SHALL be `unknown` without a finite positive `max`; otherwise, with
`f = used / max`, `over` when `f > 1`, `full` when `f ≥ fullAt` (default 0.95), `warning` when
`f ≥ warnAt` (default 0.75), else `ok`.

#### Scenario: Thresholds

- **WHEN** `used` goes 50, 80, 96 and 110 with `max` 100
- **THEN** the states are `ok`, `warning`, `full` and `over`

### Requirement: Context Meter Announcements

Entering a higher level (`warning`, `full`, `over`) not announced since the last re-arm SHALL
announce `messages[level]` politely once and call `onThreshold(level)`; mount, falling back and
the stream of values SHALL announce nothing. Falling back SHALL re-arm the levels above the new
one; a change of `resetKey` SHALL re-arm every level and record the current one silently.
`announce="off"` SHALL suppress the announcements but not `onThreshold`.

#### Scenario: Announced once

- **WHEN** `used` goes 80, 81, 82 with `max` 100
- **THEN** "Context almost full" is announced once

#### Scenario: New thread

- **WHEN** a meter in `warning` gets a new `resetKey` and `used` 10, then 80
- **THEN** the warning is announced again

### Requirement: Context Meter Value Text

`aria-valuetext` SHALL be `messages.valueText({ used, max, percent })` with the numbers in the
locale's compact notation (or `formatOptions`) and the percent in the locale's percent format.
Without a known max the Root SHALL have no `role="meter"` and SHALL show
`messages.unknown({ used })`.

#### Scenario: Localised

- **WHEN** the locale is `it-IT`, `used` 21400 and `max` 128000
- **THEN** the value text uses Italian compact numbers and "17%"

### Requirement: Context Meter Data Attributes

Every part SHALL carry `data-scope="context-meter"`, `data-part`, `data-instance` and
`data-state`; the Root and the Indicator SHALL carry `data-zone` (`ok`, `warning`, `full`); the
Root SHALL carry `data-percent` and set `--rind-context-meter-percent` (0 to 100, capped).

#### Scenario: Never colour alone

- **WHEN** the state is `warning`
- **THEN** the Root has `data-zone="warning"` for a theme to change more than the colour

### Requirement: Context Meter Messages

The strings SHALL come from `messages`: `label`, `valueText`, `unknown`, `warning`, `full`,
`over`, with English defaults.

#### Scenario: Localised announcement

- **WHEN** `messages.full` is "Contesto pieno" and the state becomes `full`
- **THEN** "Contesto pieno" is announced

### Requirement: Context Meter Contract

The contract SHALL locate by role `meter` and name and provide the queries `state`, `percent`
and `valueText`.

#### Scenario: Driver

- **WHEN** a test reads `getContextMeter(root).percent()`
- **THEN** it returns the Root's `data-percent` as a number

### Requirement: Context Meter Theme

`@rind-ui/theme` SHALL style the Context Meter in the `range` family, show the zone by colour
and by a second cue (stripes or an end mark, as Meter does), and work under forced colors.

#### Scenario: Zone cue

- **WHEN** the state is `full`
- **THEN** the Indicator differs from `ok` by more than its colour
