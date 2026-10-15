## Purpose

Defines rind-ui's Time Range Field: a labelled pair of segmented time fields (start and end) composed from
`paired-fields` and Time Field behaviour, whose value is a range of times, wired into Field validation and HTML forms
through two hidden native inputs. Introduced by `add-time-range-field`.

## ADDED Requirements

### Requirement: Composition Parity

The Time Range Field SHALL have the Date Range Field's anatomy, `paired-fields` behaviour (derived value, ends never edit
each other, focus between ends, names, hidden inputs, controlled value, clear and reset), Field integration, disabled and
read-only rules, data attributes and theme rules (scope `time-range-field`), with each end behaving as a Time Field
(hour cycles, day period, zones and DST), except where this specification differs.

#### Scenario: Standalone time range

- **WHEN** a Time Range Field labelled "Shift" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Shift" containing spinbuttons named "hour Start time Shift",
  "minute Start time Shift", "AM/PM Start time Shift" and the same three for the end

### Requirement: Value And Time Types

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of type
`{ start: Time; end: Time } | null`; an end that is a `CalendarDateTime` or `ZonedDateTime` SHALL keep its date and zone,
only its time changing. `minValue`/`maxValue` SHALL be `Time`s applied to both ends; `granularity` SHALL be `hour`,
`minute` (default) or `second`. Times SHALL never pass through a JavaScript `Date` in the viewer's zone. The exported types
SHALL include `TimeRangeValue` next to `DateRangeValue`.

#### Scenario: Hour not shifted by the viewer's zone (zag#3187)

- **WHEN** a viewer in `Europe/Rome` types 09:00 and 17:30 into the two ends
- **THEN** the value is `{ start: Time(9, 0), end: Time(17, 30) }`

#### Scenario: Type exported (reka-ui#2589)

- **WHEN** a consumer imports the range value type for a time range
- **THEN** `TimeRangeValue` is available from the package

### Requirement: Ordering And Overnight

For `Time` ends, an end before the start SHALL be invalid with `messages.endBeforeStart` (default "End time must be after the
start time"); an equal end SHALL be valid. With `allowsOvernight`, an end before the start SHALL be valid, the value SHALL be
the two times and the group's value description SHALL say the range ends the next day (`messages.overnight`, default
"{end} the next day"). For date-time and zoned ends the ordering SHALL be `compare()` of the values (instants for zoned
values), `allowsOvernight` SHALL have no effect and an end before the start SHALL be invalid.

#### Scenario: Strict by default

- **WHEN** the user types start 22:00 and end 06:00 without `allowsOvernight`
- **THEN** both ends keep their text, the value is `null` and the field is invalid with "End time must be after the start
  time"

#### Scenario: Overnight allowed

- **WHEN** `allowsOvernight` is set and the user types start 22:00 and end 06:00
- **THEN** the value is `{ start: 22:00, end: 06:00 }` and the group description contains "the next day"

#### Scenario: Zoned ends across DST

- **WHEN** the start is 2026-11-01 00:30 and the end 2026-11-01 01:30 in `America/New_York`, the end on the second pass of the
  repeated hour
- **THEN** the range is valid and ordered by instant

### Requirement: Day Period Per End

Typing in an end's hour segment SHALL never change that end's day period, and the day period SHALL be resolved from the
locale's formatter parts; each end SHALL keep its own period.

#### Scenario: Hour typed in a PM end (bits-ui#1985)

- **WHEN** in a 12-hour field the end is 2:00 PM and the user types "1" into its hour
- **THEN** the end is 1:00 PM

#### Scenario: Spanish day period (reka-ui#2956)

- **WHEN** in `es-ES` the start is 3:30 p. m. and the user types "3" into its hour
- **THEN** the start stays 3:30 p. m.

### Requirement: Form Values

The two hidden inputs SHALL be `type="time"` for `Time` ends with `step` 3600, 60 or 1 for hour, minute or second granularity
and native `min`/`max`, valued with the ISO time ("14:30" or "14:30:15") of each end when the pair is a valid range and `""`
otherwise; date-time ends SHALL use Date Field's mapping. `startName` and `endName` SHALL name them.

#### Scenario: Two times submitted

- **WHEN** the value is 09:00–17:30 with `startName="open"` and `endName="close"` in a form
- **THEN** the form data has `open=09:00` and `close=17:30`

### Requirement: Contract

The Time Range Field SHALL ship a contract with scope `time-range-field` with Date Range Field's actions, queries, states and
traits, `fill({ start, end })` typing times in the locale's order (including the day period as "a"/"p"), an extra action
`setDayPeriod(edge, "am" | "pm")`; its invariants SHALL be the segment and pair invariants plus: no hour edit changed its
end's day period, and each hidden input's value equals the oracle's ISO time or `""`.

#### Scenario: Driver fills a 12-hour range

- **WHEN** `getTimeRangeField(screen, { name: "Shift" }).fill({ start: "09:00", end: "17:30" })` runs in `en-US`
- **THEN** the ends show 9:00 AM and 5:30 PM and `range()` is `{ start: "09:00", end: "17:30" }`

### Requirement: Theme

`@rind-ui/theme` SHALL style the Time Range Field in `time-range-field.css` as family `field` with `--rind-time-range-field-*`
tokens defaulting to the semantic tokens Date Range Field uses, the same focus, placeholder, invalid and forced-colors rules,
and tabular numerals.

#### Scenario: Same look as Date Range Field

- **WHEN** a Date Range Field and a Time Range Field are rendered side by side with no token overrides
- **THEN** their height, boundary, radius and focus ring are identical
