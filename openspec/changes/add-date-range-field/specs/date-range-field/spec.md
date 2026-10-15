## Purpose

Defines rind-ui's Date Range Field: a labelled group of two segmented date fields (start and end) following
`paired-fields` and `date-segments`, whose value is a range of `@internationalized/date` values, wired into Field
validation and HTML forms through two hidden native inputs. Introduced by `add-date-range-field`.

## ADDED Requirements

### Requirement: Anatomy

The Date Range Field SHALL consist of a `root` part (`div`), the Field parts `label`, `description` and
`error-message`, an `input` part (`div`, the group), `start` and `end` parts (`div`), a `separator` part (`span`),
one `segment` part per segment of each end, and two hidden native inputs rendered automatically (part
`hidden-input`, `data-edge`). Segments SHALL be renderable from a render function receiving the segment lists
of both ends, or automatically. Every part SHALL accept element substitution and forward its element's attributes.

#### Scenario: Standalone range field

- **WHEN** a Date Range Field labelled "Stay" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Stay" containing six spinbuttons, three named "month
  Start date Stay", "day Start date Stay", "year Start date Stay" and three for the end

### Requirement: Value And Callbacks

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of type
`{ start: DateValue; end: DateValue } | null` as `paired-fields` defines. `placeholderValue` SHALL set the type, zone
and the starting point for both ends. `granularity`, `hourCycle`, `hideTimeZone`, `shouldForceLeadingZeros`,
`minValue`, `maxValue`, `isDateUnavailable`, `disabled`, `readOnly`, `required`, `invalid`, `form`,
`startName`, `endName` and `allowsNonContiguousRanges` SHALL behave as Date Field's and `paired-fields`' definitions.

#### Scenario: Types from the value

- **WHEN** the default value is two `CalendarDateTime`s and the user edits the end's day
- **THEN** `onValueChange` receives two `CalendarDateTime`s, the start unchanged

### Requirement: Field Integration

The Date Range Field SHALL implement `field-control` as one registered control (`paired-fields`), take `disabled`,
`readOnly`, `required` and `invalid` from the Field, report each commit as a change, and report the pair's validity
(`paired-fields` Range Validity) so the Field displays it with its validation mode. Its contract SHALL declare the
`field-associated` trait.

#### Scenario: Error names the part (react-spectrum#3328)

- **WHEN** in a Field with default validation the user types an end before the start and tabs out
- **THEN** the Field shows "End date must be on or after the start date", every segment has `aria-invalid="true"`
  and the error was announced once

### Requirement: Disabled And Read-Only

With `disabled`, every segment SHALL be a disabled input and both hidden inputs disabled. With `readOnly`, segments
SHALL be focusable read-only inputs with `aria-readonly="true"`, and keys and typing SHALL change nothing.

#### Scenario: Read-only pair stays focusable

- **WHEN** a read-only range field is tabbed into and ArrowUp is pressed on the first segment
- **THEN** the first start segment is focused and nothing changes

### Requirement: Messages

The Date Range Field SHALL take a typed `messages` object with English defaults for Date Field's strings and for
`startDate`, `endDate`, `separator`, `rangeDescription({ start, end })` and the pair's validity messages
(`endBeforeStart`, `containsUnavailable`, prefixed per part). No string reaching assistive technology SHALL be
hard-coded outside `messages`.

#### Scenario: Italian names

- **WHEN** `messages={{ startDate: "Data di inizio", endDate: "Data di fine" }}` is set
- **THEN** the first start segment's name begins with its segment name followed by "Data di inizio"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="date-range-field"`, its `data-part`, `data-instance` and the Field state attributes.
Root and Input SHALL carry `data-focus`, `data-focus-visible`, `data-placeholder-shown`, `data-complete` (both ends
complete) and `data-composing` as Date Field does. `start`, `end`, their segments and hidden inputs SHALL carry `data-edge`
(`start` or `end`); an end that is the sole cause of invalidity SHALL carry `data-invalid-edge` on the root. Segments
SHALL carry Date Field's segment attributes. `data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: Styling the invalid end

- **WHEN** the end is before the start
- **THEN** the root carries `data-invalid` and every segment `data-invalid`

### Requirement: Contract

The Date Range Field SHALL ship a contract with scope `date-range-field`, anatomy as above, located by role `group` and
exact accessible name, with: actions `fill({ start, end })`, `fillStart(date)`, `fillEnd(date)`, `typeSegment(edge, type,
text)`, `step(edge, type, direction, { large? })`, `clear()`, `clearEnd()`, `paste(edge, text)`, `resetForm()`; queries
`range()` (the two hidden inputs' values), `segments(edge)`, `focusedSegment()` (with its edge), `isInvalid()`,
`validity()` (flags and the failing part), `isComplete()`; states `idle`, `active` observed through `data-focus`;
events mapped to those actions with `END.BOUNDARY` `skip` ("covered by fill"); prop steps `$sync:value`,
`$props:locale`, `$props:disabled`; traits `field-associated`, `form-associated` (compared property: both hidden
inputs' values), segment invariants and pair invariants.

#### Scenario: Same test in both environments

- **WHEN** `getDateRangeField(screen, { name: "Stay" }).fill({ start: "2026-10-12", end: "2026-10-16" })` runs in jsdom
  and with a Playwright `page`, in `en-GB`
- **THEN** both resolve with `range()` equal to the two ISO dates

### Requirement: Theme

`@rind-ui/theme` SHALL style the Date Range Field in `date-range-field.css` as family `field` (`outline` default, `soft`;
`sm`/`md`/`lg`) through its `data-*` attributes and `--rind-date-range-field-*` tokens with semantic fallbacks: the
group as the visible control with a boundary of at least 3:1, the separator in the muted text role, a focus ring on
the focused segment, tabular numerals, segments at least 24 px tall, a `data-tone="danger"` state and visibility
under forced colors.

#### Scenario: Forced colors

- **WHEN** an invalid Date Range Field with a focused segment is rendered under forced colors
- **THEN** the boundary, the focused segment's ring, the separator and the placeholders are visible
