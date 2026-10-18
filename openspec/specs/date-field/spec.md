# date-field Specification

## Purpose
Defines rind-ui's Date Field: a labelled group of editable date (and optional time) segments
following `date-segments`, whose value is a `@internationalized/date` value, wired into Field
validation and HTML forms through a hidden native input. Introduced by `add-date-field`.
## Requirements
### Requirement: Anatomy

The Date Field SHALL consist of a `root` part (`div`), the Field parts `label`, `description`
and `error-message`, an `input` part (`div`) grouping the segments, one `segment` part per
segment of `date-segments` (an `<input>` for editable segments, a `span` for literals), and a
hidden native input that the root renders automatically (`hidden-form-input`, part
`hidden-input`). Segments SHALL be renderable from a render function receiving the segment
list, or automatically. When the Root is not inside a Field it SHALL act as one, as Text Field's
Root does; inside a Field it SHALL register as that Field's control and its own Label,
Description and ErrorMessage SHALL NOT be rendered (development warning). Every part SHALL
accept element substitution and forward its element's attributes.

#### Scenario: Standalone field

- **WHEN** a Date Field with a Label "Birthday" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Birthday" containing three elements
  with role `spinbutton` named "month Birthday", "day Birthday" and "year Birthday"

### Requirement: Value And Callbacks

The Date Field SHALL have a controllable `value` (`value`, `defaultValue`, `onValueChange(value,
details)`) of type `CalendarDate | CalendarDateTime | ZonedDateTime | null`, changed only at the
commit points of `date-segments`, keeping the value's type, calendar and zone (`date-values`).
`placeholderValue` SHALL set the type and zone when there is no value. `onValueChange` SHALL
NOT be called when the committed value equals the current one, and SHALL NOT be called by a
controlled change.

#### Scenario: Value type from the placeholder

- **WHEN** a field with no value has `placeholderValue={new CalendarDateTime(2026, 1, 1, 9, 0)}`
  and the user fills every segment
- **THEN** `onValueChange` receives a `CalendarDateTime`

### Requirement: Granularity And Time Display

`granularity` SHALL select the smallest segment: `day` (default for `CalendarDate`), `hour`,
`minute` (default for date-time values) or `second`; a granularity finer than the value's type
SHALL be a development error. `hourCycle` (12 | 24, default the locale's), `hideTimeZone` and
`shouldForceLeadingZeros` SHALL be passed to `date-segments`. A `ZonedDateTime` value SHALL show
its time zone name unless `hideTimeZone`.

#### Scenario: Minute granularity in 24-hour German

- **WHEN** a `CalendarDateTime` field in `de-DE` with `granularity="minute"` is rendered
- **THEN** its editable segments are day, month, year, hour, minute, and there is no day-period
  segment

### Requirement: Group Semantics And Value Description

The `input` part SHALL have `role="group"`, be named by the Field's Label (`aria-labelledby`),
carry `aria-disabled` when disabled, and be described by the Field's description and error ids
and by a visually hidden value description from `messages.valueDescription` (default
"Selected date: {formatted}" with the full localised date, absent when the value is `null`).
The Field's description ids SHALL reach the segments as `date-segments` defines. A press on
the Label SHALL focus the first editable segment.

#### Scenario: Group description carries the whole value

- **WHEN** the value is 14 October 2026 in `en-US`
- **THEN** the group's accessible description contains "Selected date: Wednesday, October 14,
  2026"

### Requirement: Field Integration

The Date Field SHALL implement `field-control`: register once (the group as the labelled
element, the first editable segment as the focus target, the hidden input as the validity
element), take `disabled`, `readOnly`, `required` and `invalid` from the Field, report each
commit as a change, and report the control's own validity (`date-segments` Validity) through its
validity element so the Field displays it with the Field's validation mode. Focus moving
between segments SHALL NOT count as leaving the Field. Its contract SHALL declare the
`field-associated` trait.

#### Scenario: Error shown after leaving (react-spectrum#3328)

- **WHEN** in a Field with `validationMode="blur"` the user types 02/31/2026 and tabs out of
  the last segment
- **THEN** the Field shows "Enter a valid date", every segment has `aria-invalid="true"`, and
  the error was announced once

#### Scenario: Moving between segments does not touch

- **WHEN** the user tabs from the month segment to the day segment
- **THEN** the Field is not touched

### Requirement: Form Participation

The hidden native input SHALL be declared by value type: `type="date"` for `CalendarDate`,
`type="datetime-local"` for `CalendarDateTime` with `step` 3600, 60 or 1 for hour, minute or
second granularity, and `type="text"` for `ZonedDateTime`. Its value SHALL be the value's ISO
string (gregorian; with offset and zone for `ZonedDateTime`) or `""` when the value is `null`,
including while segments hold an incomplete or impossible entry. `name`, `form`, `required`,
`disabled` and, for the native date types, `min`/`max` from `minValue`/`maxValue` SHALL be
mirrored. `autoComplete` SHALL be set on the hidden input only. A browser autofill of the hidden
input with a valid ISO string SHALL be adopted as the value.

#### Scenario: Stale form value after clearing (react-spectrum#9801)

- **WHEN** a field inside a form has 14 October 2026 and the user clears the day
- **THEN** the form data has the field's name with an empty value

#### Scenario: Seconds without step mismatch (reka-ui#3000)

- **WHEN** a `CalendarDateTime` field with `granularity="second"` holds 09:30:15 and the form
  is validated
- **THEN** the hidden input has `step="1"` and no `stepMismatch`

#### Scenario: Out of range blocks submission (reka-ui#2275)

- **WHEN** `maxValue` is 31 December 2026, the user types 1 January 2027 and submits
- **THEN** submission is cancelled and focus is on the field's first segment

### Requirement: Embedded Mode

A Date Field Root MAY run *embedded* in a host component (`embedded`, set by the host). An embedded
Root SHALL NOT register with a Field, SHALL NOT render Label, Description or ErrorMessage parts
(development warning when given), SHALL NOT render the hidden native input, and its `input` part
SHALL have `role="presentation"` instead of `group`. The host SHALL supply `labelledBy` (a list of
ids) and `describedBy` (a list of ids), which the segments use as their label and description
sources as `date-segments` defines. The Root SHALL report its own validity to the host through
`onValidityChange(flags, message)` (called when the flags or message change, and once after
mount) instead of writing to a validity element. Value, granularity, messages, data attributes
and the contract behave as for a standalone field, except the form and Field traits.

#### Scenario: Embedded field has no Field or form footprint

- **WHEN** an embedded Date Field Root is rendered inside a host with `labelledBy` naming the
  host's label
- **THEN** the field's `input` has `role="presentation"`, there is no hidden input and no Label,
  and each segment is named by the segment name followed by the host's label

#### Scenario: Validity goes to the host

- **WHEN** an embedded field's user types 02/31/2026 and leaves a segment
- **THEN** `onValidityChange` is called with the flags for an impossible date and its message,
  and no Field is touched

### Requirement: Draft Hint

The Date Field SHALL take `onDraftChange({ year, month, day })`, called after each commit point
and each segment clear with the committed segments only (numbers in the field's calendar, `null`
for an empty or uncommitted segment), only when the triple changes. Typing digits inside a
segment SHALL NOT call it. It is a hint for hosts that follow the typed date (Date Picker's
calendar) and SHALL NOT change the value or its callbacks.

#### Scenario: Calendar follows the typed month and year

- **WHEN** the user types "3" and "/" in the month segment, then "2","0","3","1" in the year
  segment of an empty field
- **THEN** `onDraftChange` was called with `{ year: null, month: 3, day: null }` and then with
  `{ year: 2031, month: 3, day: null }`, and `onValueChange` was not called

### Requirement: Disabled And Read-Only

With `disabled`, segments SHALL be disabled inputs, not focusable, and the hidden input
disabled. With `readOnly`, segments SHALL be focusable `readonly` inputs with
`aria-readonly="true"`, keys and typing SHALL change nothing, and copying SHALL work.

#### Scenario: Read-only stays focusable (reka-ui#2007)

- **WHEN** a read-only field is tabbed into
- **THEN** the first segment is focused, shows a focus ring, and ArrowUp changes nothing

### Requirement: Messages

The Date Field SHALL take a typed `messages` object with English defaults for every string of
`date-segments` (segment names fall back to `Intl.DisplayNames`; placeholders, value texts,
validity messages) and `valueDescription({ formatted })`. No string reaching assistive
technology SHALL be hard-coded outside `messages`.

#### Scenario: Italian validity message

- **WHEN** `messages={{ incomplete: "Inserisci una data completa" }}` and the field is partially
  filled and validated
- **THEN** the error message is "Inserisci una data completa"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="date-field"`, its `data-part`, `data-instance` and the Field
state attributes. Root and Input SHALL carry `data-focus` and `data-focus-visible` while a
segment has focus, `data-placeholder-shown` when every editable segment is empty,
`data-complete` when every editable segment has a value, and `data-composing` during IME
composition. Each segment SHALL carry `data-type` (its segment type or `literal`) and, when
they apply, `data-placeholder`, `data-editable`, `data-focus`, `data-focus-visible`,
`data-invalid`, `data-readonly` and `data-disabled`. `data-variant` and `data-size` SHALL pass
through untouched.

#### Scenario: Styling the empty state

- **WHEN** a field with no value is rendered
- **THEN** the root carries `data-placeholder-shown` and every editable segment
  `data-placeholder`

### Requirement: Contract

The Date Field SHALL ship a contract with scope `date-field`, anatomy as above, located by role
`group` and exact accessible name, with:

- actions: `fill(date)` (keyboard: focus the first segment and type each segment's digits in
  order; pointer: click the first segment, then type; virtual: programmatic focus, then type),
  `typeSegment(type, text)`, `step(type, "increase" | "decrease", { large? })` (keyboard only;
  pointer declared none with the reason "segments have no pointer steppers"),
  `toEdge(type, "min" | "max")`, `clearSegment(type)`, `clear()` (select all + Backspace),
  `paste(text)`, `resetForm()`;
- queries: `value()` (the hidden input's value), `segments()` (type, text, `aria-valuenow`,
  placeholder flag), `focusedSegment()`, `isInvalid()`, `validity()`, `isComplete()`,
  `isDisabled()`, `isReadOnly()`;
- states `idle`, `editing`, `composing`, observed through `data-focus` and `data-composing`;
- events mapped to those actions; `SEGMENT.FOCUS`/`SEGMENT.BLUR` `skip` ("covered by every
  action"); prop steps `$sync:value`, `$props:locale`, `$props:disabled`;
- traits `field-associated`, `form-associated` (compared property: the hidden input's `value`),
  plus the segment invariants.

#### Scenario: Same test in both environments

- **WHEN** `getDateField(screen, { name: "Birthday" }).fill("1990-12-01")` runs in jsdom and with
  a Playwright `page`, in `en-GB`
- **THEN** both resolve with `value()` equal to "1990-12-01" and the segments showing 01/12/1990

### Requirement: Segment Invariants

The contract SHALL ship invariants checked after every model step: every editable segment is a
native input in the tab order unless disabled, and no other element of the field is focusable;
no element of the field is `contenteditable`; every `aria-labelledby`/`aria-describedby` id
resolves; `aria-valuenow` of each segment equals its oracle value or is absent when empty; the
hidden input's value equals the oracle value's ISO string or ""; the hidden input never has
focus; `onValueChange` was called exactly as often as the oracle's value changed; and a segment
that was not edited in a step kept its value.

#### Scenario: Broken wrapper clamps the day

- **WHEN** a broken variant clamps the day to the placeholder month's length while typing
- **THEN** the step typing "31" fails, naming the segment-value invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Date Field in `date-field.css` as family `field` (`outline`
default, `soft`; `sm`/`md`/`lg`) through its `data-*` attributes and `--rind-date-field-*`
tokens with semantic fallbacks: the group as the visible control with a boundary of at least
3:1, a focus ring on the focused segment, placeholders in the muted text role, tabular
numerals, segments at least 24 px tall, a `data-tone="danger"` invalid state, and visibility
under forced colors.

#### Scenario: Forced colors

- **WHEN** an invalid Date Field with a focused segment is rendered under forced colors
- **THEN** the boundary, the focused segment's ring and the placeholders (`GrayText`) are visible
</content>
</invoke>

