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
`hidden-input`). In range mode the `input` SHALL also hold `start`, `end` and `separator` parts
and two hidden inputs (Range Mode); with picker parts it SHALL be wrapped by `control` and joined
by `trigger`, `clear-trigger`, `positioner`, `content` and `calendar` (Picker Parts). Segments
SHALL be renderable from a render function receiving the segment list (both ends' lists in range
mode), or automatically. When the Root is not inside a Field it SHALL act as one, as Text
Field's Root does; inside a Field it SHALL register as that Field's control and its own Label,
Description and ErrorMessage SHALL NOT be rendered (development warning). Every part SHALL
accept element substitution and forward its element's attributes.

#### Scenario: Standalone field

- **WHEN** a Date Field with a Label "Birthday" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Birthday" containing three elements
  with role `spinbutton` named "month Birthday", "day Birthday" and "year Birthday"

### Requirement: Value And Callbacks

The Date Field SHALL have a controllable `value` (`value`, `defaultValue`, `onValueChange(value,
details)`) of type `CalendarDate | CalendarDateTime | ZonedDateTime | Time | null` in single
mode and `{ start, end } | null` (`DateRangeValue`, `TimeRangeValue`) in range mode, changed only
at the commit points of `date-segments`, keeping the value's type, calendar and zone
(`date-values`; a date-time keeps its date when only its time is edited). `placeholderValue`
SHALL set the type and zone when there is no value. `onValueChange` SHALL NOT be called when the
committed value equals the current one, and SHALL NOT be called by a controlled change.

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

The group SHALL have `role="group"`, be named by the Field's Label (`aria-labelledby`), carry
`aria-disabled` when disabled, and be described by the Field's description and error ids and by
a visually hidden value description from `messages.valueDescription` (default "Selected date:
{formatted}" with the full localised date; in range mode `messages.rangeDescription`; absent when
the value is `null`). The group is the `input` part, except with picker parts, where the
`control` part is the group and the `input` has `role="presentation"` so no nested group is
announced; in range mode the `input` (or the `control` with picker parts) is the one group of
both ends and the `start` and `end` parts have no role. The Field's description ids SHALL reach
the segments as `date-segments` defines. A press on the Label SHALL focus the first editable
segment.

#### Scenario: Group description carries the whole value

- **WHEN** the value is 14 October 2026 in `en-US`
- **THEN** the group's accessible description contains "Selected date: Wednesday, October 14,
  2026"

#### Scenario: One group with picker parts

- **WHEN** a field with picker parts labelled "Birthday" is rendered
- **THEN** the `control` is the only `group` named "Birthday" and the `input` has
  `role="presentation"`

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
second granularity, `type="time"` with the same steps for `Time`, and `type="text"` for
`ZonedDateTime`. Its value SHALL be the value's ISO string (gregorian; with offset and zone for
`ZonedDateTime`; the ISO time for `Time`) or `""` when the value is `null`, including while
segments hold an incomplete or impossible entry. `name`, `form`, `required`, `disabled` and, for
the native date and time types, `min`/`max` from `minValue`/`maxValue` SHALL be mirrored.
`autoComplete` SHALL be set on the hidden input only. A browser autofill of the hidden input with
a valid ISO string SHALL be adopted as the value. In range mode there SHALL be two hidden inputs
(`startName`, `endName`), as Range Mode — Hidden Inputs And Form defines.

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
segment SHALL NOT call it. It is a hint for hosts that follow the typed date (the picker's
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
`data-complete` when every editable segment has a value (both ends in range mode), and
`data-composing` during IME composition. Each segment SHALL carry `data-type` (its segment type
or `literal`) and, when they apply, `data-placeholder`, `data-editable`, `data-focus`,
`data-focus-visible`, `data-invalid`, `data-readonly` and `data-disabled`. In range mode,
`start`, `end`, their segments and the hidden inputs SHALL carry `data-edge` (`start` or `end`),
the root SHALL carry `data-range` and, when one end is the sole cause of invalidity,
`data-invalid-edge`. The picker parts SHALL carry the attributes of Picker — Data Attributes.
`data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: Styling the empty state

- **WHEN** a field with no value is rendered
- **THEN** the root carries `data-placeholder-shown` and every editable segment
  `data-placeholder`

#### Scenario: Styling the invalid end

- **WHEN** a range-mode field's end is before its start
- **THEN** the root carries `data-invalid` and `data-invalid-edge="end"`, and every segment
  `data-invalid`

### Requirement: Contract

The Date Field SHALL ship a contract with scope `date-field`, anatomy as above, located by role
`group` and exact accessible name, with:

- actions: `fill(date)` (keyboard: focus the first segment and type each segment's digits in
  order, a day period as "a"/"p"; pointer: click the first segment, then type; virtual:
  programmatic focus, then type), `typeSegment(type, text)`, `step(type, "increase" |
  "decrease", { large? })` (keyboard only; pointer declared none with the reason "segments have
  no pointer steppers"), `toEdge(type, "min" | "max")`, `clearSegment(type)`, `clear()` (select
  all + Backspace), `paste(text)`, `resetForm()`, `setDayPeriod("am" | "pm")` (keyboard: focus
  the day period and type the letter; pointer: click it and type);
- queries: `value()` (the hidden input's value), `segments()` (type, text, `aria-valuenow`,
  placeholder flag), `focusedSegment()`, `isInvalid()`, `validity()`, `isComplete()`,
  `isDisabled()`, `isReadOnly()`;
- states `idle`, `editing`, `composing`, observed through `data-focus` and `data-composing`;
- events mapped to those actions; `SEGMENT.FOCUS`/`SEGMENT.BLUR` `skip` ("covered by every
  action"); prop steps `$sync:value`, `$props:locale`, `$props:disabled`;
- traits `field-associated`, `form-associated` (compared property: the hidden input's `value`),
  plus the segment invariants and, for a time field, "no hour edit step changed the day period".

The range variant (`getDateField(target, { name, selectionMode: "range" })`) SHALL run over the
coordinator's graph (`START.COMMIT` / `END.COMMIT` mapped to `fillStart` / `fillEnd`, `CLEAR` to
`clear`, the ends' validity reports, the parent's value and a form reset to skips) and declare
`fill({ start, end })`, `fillStart(date)`, `fillEnd(date)`, `clear()`, `clearEnd()`,
`typeSegment(edge, type, text)`, `step(edge, type, direction, { large? })`, `paste(edge, text)`,
`resetForm()` and, with time values, `setDayPeriod(edge, period)`; the queries `range()` (both
hidden inputs' values), `segments(edge)`, `focusedSegment()` (with its edge), `validity()`,
`isInvalid()`, `invalidEdge()` and `isComplete()`; the trait `field-associated`; and the pair
invariants. The picker variant (`picker: true`) SHALL add `open()`,
`openFromField()`, `close()`, `selectDate(date)` (in range mode `selectRange(start, end)`,
`startRange(date)` and `cancel()`), `pressOutside()`, `tab()`, `shiftTab()`, the queries
`isOpen()`, `isModal()`, `closeReason()`, `focusedElement()`, `calendar()` (the Calendar driver
scoped to the content) and, in range mode, `anchor()`; states `closed` and `open` observed
through the trigger's `data-state`; prop step `$sync:open`; traits `layer`, `restores-focus`,
`presence`, `anchored` and `modal` when the prop is set; and the picker invariants (plus, in range
mode, "the anchor is cleared whenever the popover is closed").

#### Scenario: Same test in both environments

- **WHEN** `getDateField(screen, { name: "Birthday" }).fill("1990-12-01")` runs in jsdom and with
  a Playwright `page`, in `en-GB`
- **THEN** both resolve with `value()` equal to "1990-12-01" and the segments showing 01/12/1990

#### Scenario: Driver fills a 12-hour time

- **WHEN** `getDateField(screen, { name: "Alarm" }).fill("21:05")` runs on a time field in `en-US`
- **THEN** the segments show 9:05 PM and `value()` is "21:05"

#### Scenario: Range picker round trip

- **WHEN** `getDateField(screen, { name: "Stay", selectionMode: "range", picker: true })
  .selectRange("2026-10-12", "2026-10-16")` runs in jsdom and with a Playwright `page`
- **THEN** both resolve with `range()` equal to the two ISO dates and the popover closed

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
under forced colors. The same sheet SHALL style range mode (the separator in the muted text
role) and the picker parts: the trigger as a ghost control with the `calendar` icon drawn on the
part when it has no children, at least 24 × 24 px, and the content as family `panel` with entry
and exit transitions honouring reduced motion; the range, preview and anchor look stays the
Calendar's (`calendar.css`). A time field and a date field with no token overrides SHALL look
the same.

#### Scenario: Forced colors

- **WHEN** an invalid Date Field with a focused segment is rendered under forced colors
- **THEN** the boundary, the focused segment's ring and the placeholders (`GrayText`) are visible

#### Scenario: Open picker under forced colors

- **WHEN** an open, invalid range picker with an anchor and a preview is rendered under forced
  colors
- **THEN** the control boundary, the trigger icon, the content boundary, the range and the dashed
  preview are visible

#### Scenario: Icon replaced

- **WHEN** the consumer renders children inside the trigger
- **THEN** the children are shown and no masked icon is drawn

### Requirement: Time Values

A Date Field whose granularity is at least `hour` and whose `maxGranularity` is `hour` (or whose
value is a `Time`) SHALL show no date segments: it is the time field, with every Date Field rule
unless a time requirement below differs. There SHALL be no separate Time Field component.

Its value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of
type `Time | CalendarDateTime | ZonedDateTime | null`. A `Time` value SHALL be emitted as a
`Time`; a date-time value SHALL keep its date and zone, only its time changing. `minValue` and
`maxValue` SHALL be `Time`s, compared on the value's day for date-time values. `granularity`
SHALL be `hour`, `minute` (default) or `second`. Times SHALL never pass through a JavaScript
`Date` in the viewer's zone. A `null` value SHALL show placeholders, never midnight.

#### Scenario: Hour not shifted by the viewer's zone (zag#3187)

- **WHEN** a viewer in `Europe/Rome` types "0" into the hour segment of a 24-hour field and tabs
  through the minutes "00"
- **THEN** the value is `Time(0, 0)`

#### Scenario: Null shows placeholders (reka-ui#1791)

- **WHEN** the parent sets the value to `null`
- **THEN** every segment shows its placeholder and none shows "12:00 AM"

#### Scenario: Date kept

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user types 10:45
- **THEN** the value is `CalendarDateTime(2026, 10, 14, 10, 45)`

#### Scenario: Standalone time field

- **WHEN** a time field labelled "Alarm" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Alarm" containing spinbuttons named
  "hour Alarm", "minute Alarm" and "AM/PM Alarm" (the locale's display name for the day period)

### Requirement: Time Values — Hour Cycles

`hourCycle={24}` SHALL show hours 0–23 with no day-period segment; `hourCycle={12}` SHALL show
hours 1–12 with a day-period segment placed where the locale's pattern puts it; without the
prop the locale's cycle SHALL be used, and the prop SHALL always win over the locale. Typing in
the hour segment SHALL wait for a second digit after "0"–"2" in 24-hour and after "0"–"1" in
12-hour, and advance after any other digit; "0" committed alone in 12-hour SHALL mean 12.

#### Scenario: 24-hour prop in an en-US page (reka-ui#2463, reka-ui#2466, bits-ui#941)

- **WHEN** `hourCycle={24}` is set with locale `en-US` and the user types "1","5"
- **THEN** the hour is 15 and the value's hour is 15

#### Scenario: Zero-based 24-hour (bits-ui#914, reka-ui#1154)

- **WHEN** the user types "0","0" into the hour of a 24-hour field
- **THEN** the hour shows "00" and the value's hour is 0

#### Scenario: Two-digit 12-hour hour (bits-ui#1662)

- **WHEN** the user types "1","1" into the hour of an `en-US` field
- **THEN** the hour is 11 and focus moved to the minutes only after the second "1"

#### Scenario: Locale default 24-hour (bits-ui#1659)

- **WHEN** a field without `hourCycle` is rendered in `nl-NL`
- **THEN** hours range 0–23 and ArrowUp from 12 gives 13

### Requirement: Time Values — Day Period

The day period SHALL be its own segment value. Editing, clearing or stepping the hour SHALL
never change it; stepping the hour across 11↔12 in 12-hour SHALL wrap within 1–12 without
changing it. It SHALL be set by ArrowUp/ArrowDown, by typing as `date-segments` defines (the
locale's names after composition, and "a"/"p" in every locale), and its names SHALL come from
the formatter's parts for 00:00 and 12:00 in the field's locale.

#### Scenario: Clearing the hour keeps PM (react-spectrum#6793)

- **WHEN** the field shows 6:45 PM and the hour is cleared
- **THEN** the day period still shows PM

#### Scenario: Editing hour then minutes (bits-ui#2145, reka-ui#2262, bits-ui#1985)

- **WHEN** the field shows 9:30 PM and the user types "1","1" in the hour, then "1","5" in the
  minutes
- **THEN** the value is 23:15

#### Scenario: Spanish day period (reka-ui#2956)

- **WHEN** a 12-hour `es-ES` field has the value 15:30
- **THEN** the day-period segment shows the locale's PM name ("p. m.") and typing "3" into the
  hour gives 15:30 again

### Requirement: Time Values — Time Zones And Daylight Saving

A `ZonedDateTime` value SHALL show its time zone name as a read-only segment unless
`hideTimeZone`. Stepping the hour SHALL use the value's zone, so on a fall-back day both
occurrences of the repeated hour are reachable in order and on a spring-forward day the skipped
hour is not offered. Typing an hour that does not exist on that day SHALL resolve to the later
valid time, as `ZonedDateTime` does.

#### Scenario: Repeated hour

- **WHEN** the value is 2026-11-01 00:30 in `America/New_York` and ArrowUp is pressed on the
  hour twice
- **THEN** the field shows 1:30 AM with the EDT offset, then 1:30 AM with the EST offset

### Requirement: Time Values — Form Value

For a `Time` value the hidden input SHALL be `type="time"` with `step` 3600, 60 or 1 for hour,
minute or second granularity, native `min`/`max` from `minValue`/`maxValue`, and the value's ISO
time (for example "14:30" or "14:30:15") or `""`; date-time values SHALL use Date Field's mapping.
A field cleared or partially filled SHALL submit `""`.

#### Scenario: Hidden value after clearing (react-spectrum#9801)

- **WHEN** a field holding 14:30 has its minutes cleared inside a form
- **THEN** the form data has the field's name with an empty value

#### Scenario: Minimum time blocks submission

- **WHEN** `minValue` is 09:00, the user types 08:30 and submits
- **THEN** submission is cancelled with the browser's range message and focus is on the hour

### Requirement: Range Mode

`selectionMode` SHALL be `"single"` (default) or `"range"`, as on the Calendar. In range mode the
Date Field SHALL render, inside its `input` group, a `start` part (`div`) and an `end` part (`div`)
each holding one end's segments, a `separator` part (`span`) between them, and two hidden native
inputs (part `hidden-input`, `data-edge`); the segment render function SHALL receive both ends'
segment lists. The value SHALL be `{ start, end } | null` (types `DateRangeValue` and
`TimeRangeValue` exported), `startName` and `endName` SHALL name the hidden inputs, and
`allowsNonContiguousRanges` SHALL be accepted. Every other prop SHALL behave as in single mode,
applied to both ends. Each end SHALL be an embedded Date Field (Embedded Mode) whose committed
value and validity a coordinator combines; the embedded ends SHALL NOT claim the Field. Select
all and Backspace in a segment of either end SHALL clear both ends (Range Mode — Controlled
Value, Clear And Reset). `DateField.Start`, `DateField.Separator` and `DateField.End` SHALL be
renderable inside `DateField.Input` for a custom layout. The requirements "Range Mode — …" below define the pair; "the pair" is a
range-mode Date Field. Time ends follow the time requirements per end.

#### Scenario: Standalone range field

- **WHEN** a range-mode Date Field labelled "Stay" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Stay" containing six spinbuttons, three named
  "month Start date Stay", "day Start date Stay", "year Start date Stay" and three for the end

#### Scenario: Standalone time range

- **WHEN** a range-mode time field labelled "Shift" is rendered in `en-US`
- **THEN** the group "Shift" contains spinbuttons named "hour Start time Shift", "minute Start time
  Shift", "AM/PM Start time Shift" and the same three for the end

#### Scenario: Types from the value

- **WHEN** the default value is two `CalendarDateTime`s and the user edits the end's day
- **THEN** `onValueChange` receives two `CalendarDateTime`s, the start unchanged

#### Scenario: Type exported (reka-ui#2589)

- **WHEN** a consumer imports the range value type for a time range
- **THEN** `TimeRangeValue` is available from the package

### Requirement: Range Mode — One Control Two Embedded Fields

The pair SHALL be one control whose two ends (`start`, `end`) are embedded Date Field instances driven by one coordinator.
Inside a Field the pair SHALL register once (the `Input` group as the labelled element, the first invalid
or first start segment as the focus target, the start hidden input as the validity element); the embedded
fields SHALL NOT register, so no "second control" warning is produced. When the Root is not inside a Field
it SHALL act as one. Moving focus between the ends SHALL NOT count as leaving the Field.

#### Scenario: No second-control warning

- **WHEN** a range field is rendered inside a Field
- **THEN** no development warning about a second control is reported and the Field's Label names the group

#### Scenario: Moving between ends does not touch

- **WHEN** the user tabs from the last start segment to the first end segment
- **THEN** the Field is not touched and no validation runs

### Requirement: Range Mode — Derived Value

The public value SHALL be `{ start, end } | null`: both ends complete real dates (or times) in order, and
not invalid by the range rules, else `null`. A partial range SHALL never be a public value. `onValueChange`
SHALL be called once when the derived value changes (by `compare()` of each end) with `details.reason` of the
originating segment event and the `edge`, and SHALL NOT be called by a controlled change. Each end SHALL keep
its own type, calendar, zone and time of day (`date-values`).

#### Scenario: Partial entry is null

- **WHEN** the start is complete and the end is empty
- **THEN** the value is `null`, the start segments keep their text and the root has no `data-complete`

#### Scenario: Null never throws (reka-ui#1769)

- **WHEN** the value is `null` at mount, after a range, and after typing one end
- **THEN** nothing throws in any of the three states

#### Scenario: End typed first (zag#2809)

- **WHEN** the user types the end date, then the start date, earlier than the end
- **THEN** the value becomes `{ start, end }` once the start commits, and `onValueChange` was called once

### Requirement: Range Mode — Ends Never Edit Each Other

Validation SHALL report; it SHALL NOT change any segment of either end. Each end SHALL have its own draft and
limits (a day limit comes from that end's own month and year); the other end's value SHALL never constrain
what can be typed. A typed range whose end is before its start SHALL be kept as typed and reported invalid.

#### Scenario: Typing the end year leaves the start alone (bits-ui#1348)

- **WHEN** the start is 05/05/1999 and the user types "2" into the end year
- **THEN** the start still shows 05/05/1999 and no segment of the start changed

#### Scenario: End day limited by its own month (bits-ui#1445, bits-ui#2120)

- **WHEN** in `en-GB` the start is 01/11/2024 and the user types "3","1" into the end day of an end whose
  month and year are August 2026
- **THEN** the end day is 31

#### Scenario: Inverted range kept (zag#3186)

- **WHEN** the user types start 06/20/2026 and end 06/10/2026
- **THEN** both ends keep their text, the value is `null` and the pair is invalid with "End date must be
  on or after the start date"

### Requirement: Range Mode — Range Validity

The pair SHALL report as the control's own validity, on the start hidden input, the first problem of: an end
incomplete or impossible (`badInput`), an end outside `minValue`/`maxValue`, an end that
`isDateUnavailable`, the end before the start, and — unless `allowsNonContiguousRanges` — a range containing
an unavailable day. Messages SHALL name the part ("Start date: Enter a valid date", "End date must be on or after the
start date", "The range includes an unavailable date"); equal ends SHALL be valid. A pair whose ends are all
empty SHALL be valid unless `required`. The unavailable-inside check SHALL iterate the range's days up to 366
days and use the unavailable boundaries beyond that.

#### Scenario: Range over an unavailable day (react-spectrum#5302)

- **WHEN** weekends are unavailable and the user types Monday 12 – Friday 16 October 2026 then 12 –
  Wednesday 21 October
- **THEN** the first is valid, the second is invalid with "The range includes an unavailable date"

#### Scenario: Non-contiguous allowed

- **WHEN** `allowsNonContiguousRanges` is set and the same range is typed
- **THEN** it is valid and the value is the range

#### Scenario: Same day

- **WHEN** both ends are 14 October 2026
- **THEN** the value is `{ start: 2026-10-14, end: 2026-10-14 }` and the pair is valid

#### Scenario: One end empty is incomplete

- **WHEN** a required pair has only its start filled and the form is submitted
- **THEN** submission is cancelled and focus is on the first end segment

### Requirement: Range Mode — Focus Between Ends

Completing the last editable segment of the start by typing SHALL move focus to the first editable segment of the
end; completing the last segment of the end SHALL leave focus in place. ArrowRight/ArrowLeft SHALL move to the
visually adjacent segment across both ends (so in RTL the start is on the right), Tab and Shift+Tab SHALL pass
through every segment of both ends, and Backspace in an empty first end segment SHALL focus the last start
segment without changing it. Focus SHALL move after the keystroke's commit is applied. A press on the group
outside any segment SHALL focus the last non-empty segment before the press point across both ends, else the
first start segment; a press on the Label SHALL focus the first start segment.

#### Scenario: Keystroke not lost across ends (react-spectrum#10683)

- **WHEN** in `zh-TW` the user types "2026","08","05" into the start
- **THEN** the start value is 2026-08-05 and focus is on the end's first segment

#### Scenario: Back to the start

- **WHEN** the first end segment is empty and focused and Backspace is pressed
- **THEN** focus moves to the last start segment and the start is unchanged

#### Scenario: RTL arrows

- **WHEN** the pair is rendered with `dir="rtl"` and focus is on the last start segment
- **THEN** the arrow key toward the end part moves focus to the first end segment

### Requirement: Range Mode — Names And Description

The `Input` SHALL be a `group` named by the Label. Each editable segment SHALL be named by its segment name, the
end name (`messages.startDate` / `messages.endDate`, defaults "Start date" / "End date") and the Label, in
that order, through `aria-labelledby`. The `Start` and `End` wrappers SHALL have no role. The group SHALL be
described by the Field's ids and a visually hidden value description `messages.rangeDescription({ start, end })`
(default "Selected range: {start} to {end}", full localised dates), absent when the value is `null`. The Field's
description ids SHALL be on the first start segment only, unless the pair is invalid.

#### Scenario: Segment name carries the end

- **WHEN** an `en-US` range field labelled "Stay" is rendered
- **THEN** the first end spinbutton's name is "month End date Stay" and no nested group is announced

#### Scenario: Range described

- **WHEN** the value is 14–16 October 2026
- **THEN** the group's accessible description contains "Selected range: Wednesday, October 14, 2026 to
  Friday, October 16, 2026"

### Requirement: Range Mode — Hidden Inputs And Form

The pair SHALL render two hidden native inputs (`hidden-form-input`), `startName` and `endName`, of the type
Date Field declares for the value type (and time field for times), each with the ISO value of its end **only
when the pair's value is a valid range** and `""` otherwise, and mirroring `form`, `required`, `disabled` and
the native `min`/`max`. The start input SHALL be the registered validity element; native flags of the end
input SHALL be reflected in the control's message on the start input. A browser autofill of either input with a
valid ISO string SHALL be adopted into that end.

#### Scenario: Two values in the form data

- **WHEN** the value is 14–16 October 2026 with `startName="from"` and `endName="to"` inside a form
- **THEN** the form data has `from=2026-10-14` and `to=2026-10-16`

#### Scenario: Empty, not "undefined"

- **WHEN** the pair is empty or only its start is complete
- **THEN** both form values are empty strings

#### Scenario: Unnamed

- **WHEN** no names are given
- **THEN** both hidden inputs still have generated ids and the pair submits nothing

### Requirement: Range Mode — Controlled Value Clear And Reset

A controlled value change (including `null`) SHALL replace both ends and every partial segment and buffer, even while
a segment is focused, keeping focus where it is. `CLEAR` (select all + Backspace in a segment of the pair) SHALL clear
both ends. A form reset SHALL restore the default range and clear partial segments. Setting `{ start: undefined, end:
undefined }` is not a value of this component.

#### Scenario: Programmatic clear (reka-ui#1939, reka-ui#1891, bits-ui#391)

- **WHEN** a complete range is shown and the parent sets the value to `null`
- **THEN** every segment of both ends shows its placeholder

#### Scenario: Clear while one end is partial

- **WHEN** the start is complete, the end holds only a month and the parent sets `null`
- **THEN** both ends are empty

#### Scenario: Reset

- **WHEN** the form is reset with a default range of 1–3 October
- **THEN** the segments show 1–3 October and any partial text is gone

### Requirement: Range Mode — Granularity And Locale Changes

A change of `granularity`, `hourCycle`, locale or calendar SHALL recompute the segments of both ends, keep every
segment's value and keep focus on the segment of the same type and end.

#### Scenario: Granularity switch keeps the date (react-spectrum#7348)

- **WHEN** both ends have dates, `granularity` changes from `day` to `minute` and the user types an hour into
  the start
- **THEN** the start's date is unchanged

### Requirement: Range Mode — Pair Invariants

The contract fragment SHALL ship invariants checked after every model step: the public value equals the value derived
from the two ends' committed values; no step changed a segment of an end other than the one edited, cleared or
adopted; exactly two hidden inputs exist, neither ever focused; each hidden input's value equals the oracle's end
ISO string only when the value is a range, else `""`; every `aria-labelledby`/`aria-describedby` id resolves (the generic IDREF invariant); exactly one
Field registration (a second one logs the Field's second-control warning, which fails the jsdom suite);
`onValueChange` was called exactly as often as the derived value changed (a step invariant of
`@rind-ui/testing`, `dateRangeStepInvariants`). The untouched-end invariant reads each end against
the dates the model typed into it (`dateRangeArgs`) and the instance's initial value.

#### Scenario: Broken coordinator pushes the start back

- **WHEN** a broken variant rewrites the start when the end becomes earlier
- **THEN** the step fails naming the "other end untouched" invariant

### Requirement: Range Mode — Field Integration

A range-mode Date Field SHALL implement `field-control` as one registered control (Range Mode — One Control Two Embedded Fields), take `disabled`,
`readOnly`, `required` and `invalid` from the Field, report each commit as a change, and report the pair's validity
(Range Mode — Range Validity) so the Field displays it with its validation mode. Its contract SHALL declare the
`field-associated` trait.

#### Scenario: Error names the part (react-spectrum#3328)

- **WHEN** in a Field with default validation the user types an end before the start and tabs out
- **THEN** the Field shows "End date must be on or after the start date", every segment has `aria-invalid="true"`
  and the error was announced once

### Requirement: Range Mode — Disabled And Read-Only

With `disabled`, every segment SHALL be a disabled input and both hidden inputs disabled. With `readOnly`, segments
SHALL be focusable read-only inputs with `aria-readonly="true"`, and keys and typing SHALL change nothing.

#### Scenario: Read-only pair stays focusable

- **WHEN** a read-only range field is tabbed into and ArrowUp is pressed on the first segment
- **THEN** the first start segment is focused and nothing changes

### Requirement: Range Mode — Messages

In range mode `messages` SHALL add English defaults for
`startDate`, `endDate`, `separator`, `rangeDescription({ start, end })` and the pair's validity messages
(`endBeforeStart`, `containsUnavailable`, prefixed per part). No string reaching assistive technology SHALL be
hard-coded outside `messages`.

#### Scenario: Italian names

- **WHEN** `messages={{ startDate: "Data di inizio", endDate: "Data di fine" }}` is set
- **THEN** the first start segment's name begins with its segment name followed by "Data di inizio"

### Requirement: Range Mode — Time Ends And Overnight

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

### Requirement: Range Mode — Day Period Per End

Typing in an end's hour segment SHALL never change that end's day period, and the day period SHALL be resolved from the
locale's formatter parts; each end SHALL keep its own period.

#### Scenario: Hour typed in a PM end (bits-ui#1985)

- **WHEN** in a 12-hour field the end is 2:00 PM and the user types "1" into its hour
- **THEN** the end is 1:00 PM

#### Scenario: Spanish day period (reka-ui#2956)

- **WHEN** in `es-ES` the start is 3:30 p. m. and the user types "3" into its hour
- **THEN** the start stays 3:30 p. m.

### Requirement: Range Mode — Time Form Values

The two hidden inputs SHALL be `type="time"` for `Time` ends with `step` 3600, 60 or 1 for hour, minute or second granularity
and native `min`/`max`, valued with the ISO time ("14:30" or "14:30:15") of each end when the pair is a valid range and `""`
otherwise; date-time ends SHALL use the single field's mapping. `startName` and `endName` SHALL name them.

#### Scenario: Two times submitted

- **WHEN** the value is 09:00–17:30 with `startName="open"` and `endName="close"` in a form
- **THEN** the form data has `open=09:00` and `close=17:30`

### Requirement: Picker Parts

The Date Field SHALL accept optional picker parts: `control` (`div`, the group and popover anchor
around `input`), `trigger` (`button`), `clear-trigger` (`button`), `positioner`, `content` (`div`,
`role="dialog"`), `close-trigger` (`button`, the Popover's, required with `modal`: touch screen readers have no Escape) and `calendar` (a Calendar root bound to the field, inside which the Calendar's own
parts are rendered), with the shared `Portal` optional. Rendering a `trigger` makes the field a
picker; there SHALL be no separate Date Picker or Date Range Picker component. In range mode the
`calendar` part SHALL be the Calendar in `selectionMode="range"`. The requirements "Picker — …"
below define the picker; `open`, `defaultOpen`, `onOpenChange`, `closeOnSelect`, `modal`,
`initialFocus`, `finalFocus`, `positioning` and `persistentElements` SHALL be Root props, in one shared
props type with the Calendar's data props so none is dropped (react-spectrum#8557).

#### Scenario: Standalone picker

- **WHEN** a Date Field with picker parts labelled "Birthday" is rendered in `en-US`
- **THEN** there is one `group` named "Birthday" containing three spinbuttons named "month Birthday",
  "day Birthday" and "year Birthday" and a button named "Choose date Birthday"

#### Scenario: Min greater than max (react-spectrum#5208)

- **WHEN** `minValue` is after `maxValue`
- **THEN** a development warning names both props and opening the calendar does not loop

#### Scenario: Standalone range picker

- **WHEN** a range-mode picker labelled "Stay" is rendered in `en-US`
- **THEN** there is one `group` named "Stay" containing six spinbuttons (the first named "month Start date Stay") and a button named
  "Choose dates Stay"

### Requirement: Picker — Calendar Binding

The `calendar` part SHALL be the Calendar bound to the picker: its `value`, `focusedValue`, `minValue`, `maxValue`,
`isDateUnavailable`, `disabled`, `readOnly`, `invalid`, locale, time zone, `firstDayOfWeek` and, in range mode,
`allowsNonContiguousRanges`, `minRangeLength`, `maxRangeLength` and `commitOnBlur` SHALL come from
the picker (so the field never accepts a range the calendar cannot pick), and its
`selectionMode` SHALL be the field's; view props (`visibleMonths`, `pageBehavior`, `fixedWeeks`, `weekdayFormat`, `messages`) SHALL be the
part's own. The picker's and the Calendar's data props SHALL be one shared props type so none is dropped (react-spectrum#8557).

#### Scenario: First day of week forwarded (react-spectrum#8557)

- **WHEN** `firstDayOfWeek="mon"` is set on the picker
- **THEN** the calendar inside the popover starts its weeks on Monday

#### Scenario: Constraints reach the calendar

- **WHEN** `maxValue` is 31 October 2026 and the popover opens on that month
- **THEN** 1 November cannot be focused or selected and the next-month trigger is `aria-disabled`

### Requirement: Picker — One Value Owner

The picker SHALL own one controllable value; the embedded field, the calendar and the hidden input SHALL be views of it. A
change from any source (field commit, calendar selection, clear, reset, autofill adoption) SHALL pass through one commit path
that calls `onValueChange(value, details)` once per change, with `details.reason` (the field's own reasons
`SEGMENT.COMMIT`, `STEP`, `PASTE`, `CLEAR`, `RESET`, and `CALENDAR` for a pick), `modality` and `cancel()`. The
field's machine is that owner: a pick is its `PICK` event, the Clear trigger its `CLEAR` event. A controlled change SHALL update all views and SHALL NOT call `onValueChange`.

#### Scenario: Field edit reaches the calendar (reka-ui#736)

- **WHEN** the popover is open and the user types a complete date into the field
- **THEN** the calendar shows that date as selected and its month visible, and `onValueChange` was called once

#### Scenario: Calendar pick reaches the field and back

- **WHEN** the user picks 20 October in the calendar and then edits the field's day to 21
- **THEN** the field shows 20 then 21 October, and the calendar's selected cell follows

#### Scenario: Cancel keeps all views

- **WHEN** `onValueChange` calls `details.cancel()` for a calendar pick
- **THEN** field, calendar and hidden input keep the previous value and the popover stays open

### Requirement: Picker — Open State And Reasons

The open state SHALL be controllable (`open`, `defaultOpen`, `onOpenChange(open, details)`) with `details.reason` `"trigger"` when
opening and, when closing, one of `"trigger"`, `"select"`, `"escape-key"`, `"outside-press"`, `"outside-focus"`,
`"parent-dismissed"`, `"api"`. A request SHALL call `onOpenChange`; the state changes when the prop changes in controlled mode;
`details.cancel()` keeps the state; a programmatic change of `open` SHALL NOT call `onOpenChange`.

#### Scenario: Controlled refusal

- **WHEN** a controlled picker with `open={false}` has its trigger pressed and the parent does not change `open`
- **THEN** `onOpenChange(true, …)` was called once and the content is not rendered

#### Scenario: Reason on select

- **WHEN** the user picks a date with `closeOnSelect`
- **THEN** `onOpenChange(false, …)` has reason `"select"` once

### Requirement: Picker — Opening

The trigger SHALL be a normal tab stop that opens the popover on press, Enter and Space. `Alt+ArrowDown` and `Alt+ArrowUp` on any
segment of the field (when the event is not default-prevented) SHALL open it. Focus entering the field SHALL NOT open it. When
`disabled` the trigger SHALL be disabled; when `readOnly` it SHALL stay focusable with `aria-disabled="true"` and not open. The
trigger SHALL have `data-pressed` only while a press is in progress and `data-state="open"` while the popover is open.

#### Scenario: Keyboard reaches the trigger (react-spectrum#3118)

- **WHEN** the user tabs from the last segment
- **THEN** the trigger is focused, and Enter opens the popover

#### Scenario: Alt+ArrowDown from a segment

- **WHEN** focus is on a day segment and Alt+ArrowDown is pressed
- **THEN** the popover opens, the segment's value did not change

#### Scenario: Pressed styling does not stay (react-spectrum#8339)

- **WHEN** the popover is open after a mouse press on the trigger
- **THEN** the trigger has `data-state="open"` and no `data-pressed`

#### Scenario: Read-only does not open

- **WHEN** a read-only picker's trigger is activated
- **THEN** the popover stays closed and the trigger keeps focus

### Requirement: Picker — Modality

The popover SHALL be non-modal by default: the field stays operable, nothing is made inert, scroll is not locked and Tab follows
`non-modal-tab-order` (content right after the trigger; leaving closes with reason `"outside-focus"`). With `modal` the picker
SHALL use the overlay infrastructure's modal layer (outside inert, scroll locked, Tab wraps, `aria-modal="true"` and `data-modal`
on the content). The prop SHALL never be accepted without effect.

#### Scenario: Field operable while open

- **WHEN** the popover is open and the user types in a segment
- **THEN** the popover stays open and the segment changes

#### Scenario: Modal wraps Tab (zag#2851, ark#3106)

- **WHEN** `modal` is set, the popover is open and focus is on the last tabbable element of the content and Tab is pressed
- **THEN** focus moves to the first tabbable element of the content, and the field is inert

#### Scenario: Tab leaves non-modal content

- **WHEN** focus is on the last tabbable element of the content and Tab is pressed
- **THEN** focus moves to the element after the trigger and the popover closes with reason `"outside-focus"`

### Requirement: Picker — Initial Focus And Restore

When the popover opens, focus SHALL move after its first placement to the calendar's tab stop (the selected date, else today
constrained to `minValue`/`maxValue`), in every modality; a consumer `initialFocus` replaces this (`false` skips; a function wins).
When the popover closes by any reason, focus SHALL return to the trigger (or `finalFocus`) if it was inside the content or on `body`, and
SHALL stay where it is if the user moved it to another focusable element or into the field.

#### Scenario: Focus on the selected date

- **WHEN** the value is 14 October 2026 and the popover is opened with the keyboard
- **THEN** the cell of 14 October is focused

#### Scenario: Consumer prevents the focus (bits-ui#2118)

- **WHEN** `initialFocus` returns `false`
- **THEN** focus stays on the trigger

#### Scenario: Escape

- **WHEN** focus is in the calendar and Escape is pressed
- **THEN** the popover closes with reason `"escape-key"` and focus is on the trigger

#### Scenario: Select returns focus to the trigger

- **WHEN** the user picks a date with the keyboard
- **THEN** the popover closes and the trigger is focused with `data-focus-visible`

#### Scenario: Focus in the field stays

- **WHEN** the popover is open and the user clicks a segment, then presses Escape
- **THEN** the popover closes and the segment keeps focus

### Requirement: Picker — Dismissal And Nesting

The Control (field, trigger, clear trigger) and the content SHALL count as inside the picker for dismissal and for the Field's
focus accounting: focus or a press within them SHALL NOT close the popover or mark the Field touched, and a press on the field
SHALL NOT dismiss. A picker opened from inside another layer (a Dialog or Drawer) SHALL be that layer's child by the layer
context whatever its DOM position; one user gesture SHALL close at most one layer; selecting a date SHALL never close the host layer;
layers opened from the calendar's header (a Select) are inside.

#### Scenario: Pick a date inside a Dialog (ark#3107, ark#3268, radix#3480)

- **WHEN** a picker whose content is portalled to the end of `body` is open inside a modal Dialog and the user clicks a date
- **THEN** the date is selected, the picker closes and the Dialog stays open

#### Scenario: Touch inside a Drawer (zag#2084)

- **WHEN** the same happens with touch pointer events
- **THEN** the same result

#### Scenario: Scroll outside then tap inside (reka-ui#2891)

- **WHEN** on touch the user scrolls the page starting outside the popover, then taps a date inside it
- **THEN** the date is selected and the popover closes only because of the selection

#### Scenario: Opening does not touch the Field (react-spectrum#3272)

- **WHEN** in a Field with `blur` validation mode the user opens the popover from the keyboard
- **THEN** focus moved into the content and the Field is not touched

### Requirement: Picker — Select And Close

Selecting a date in the calendar (press or Enter/Space) SHALL commit it through the commit path and, with `closeOnSelect`
(default `true`), close the popover with reason `"select"`, also when the date equals the current value. The new value SHALL keep the
current value's type, calendar, time of day and zone; with no value it SHALL use `placeholderValue`'s type and time, else a
`CalendarDate` at granularity `day` and a `CalendarDateTime` at 00:00 at granularity `hour`, `minute` or `second`. A picked date
SHALL commit at once; no date SHALL be held aside awaiting a time. Pressing the selected date SHALL NOT deselect it.

#### Scenario: Same date closes (react-spectrum#4750)

- **WHEN** the value is a `ZonedDateTime` on 14 October and the user picks 14 October again
- **THEN** the popover closes and the value is unchanged

#### Scenario: Time kept

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user picks 20 October
- **THEN** the value is `CalendarDateTime(2026, 10, 20, 9, 30)`

#### Scenario: No value at minute granularity (react-spectrum#6957)

- **WHEN** no value is set, `granularity="minute"`, `closeOnSelect={false}` and the user picks 20 October
- **THEN** the field shows 20 October at 12:00 AM and the value is `CalendarDateTime(2026, 10, 20, 0, 0)`

#### Scenario: Stay open

- **WHEN** `closeOnSelect={false}` and a date is picked
- **THEN** the popover stays open with the picked date selected

### Requirement: Picker — Typing While Open

While the popover is open, a committed field value SHALL set the calendar's focused date to the value; a field draft with a known
year and month but no complete date SHALL show that month in the calendar (the focused date's day kept, clamped). A partial or
impossible entry SHALL make the value `null` and deselect the calendar without closing it. Select-all + Backspace in the field
SHALL clear the value and the calendar's selection.

#### Scenario: Month follows the typing

- **WHEN** the popover is open and the user types month 03 and year 2027 without a day
- **THEN** March 2027 is visible in the calendar and nothing is selected

#### Scenario: Clearing the text clears the value (zag#2173, reka-ui#1195)

- **WHEN** the field shows 14 October 2026 and the user selects all and presses Backspace
- **THEN** the value is `null`, the calendar has no selected cell and `onValueChange(null)` was called once

#### Scenario: Reselect after clear (ark#1124)

- **WHEN** the value is cleared and the user picks the previously selected date again
- **THEN** the value is that date

### Requirement: Picker — Names And Description

The Control SHALL be a `group` named by the Label and described by the Field's ids and a visually hidden value description
`messages.valueDescription({ formatted })` (default "Selected date: {formatted}", absent when the value is `null`). The embedded
field's `Input` SHALL have `role="presentation"` so no nested group is announced. The trigger SHALL have `aria-haspopup="dialog"`, `aria-expanded` and, while the content is
mounted, `aria-controls`, and SHALL be named by `messages.trigger` and the Label (`aria-labelledby` its own id and the Label's) and described by the value description. The content
SHALL be a `dialog` named by the trigger name and the Label unless a Title or consumer name is given. No string reaching assistive technology SHALL be
hard-coded outside `messages`.

#### Scenario: Names

- **WHEN** an `en-US` picker labelled "Birthday" is rendered
- **THEN** the group is named "Birthday", the trigger "Choose date Birthday" and, once open, the dialog "Choose date Birthday"

#### Scenario: Value spoken on the trigger

- **WHEN** a date is picked and the popover closes
- **THEN** the focused trigger's accessible description contains "Selected date: Wednesday, October 14, 2026"

#### Scenario: Custom names (reka-ui#2366)

- **WHEN** `messages={{ trigger: "Datum wählen" }}` is set
- **THEN** the trigger is named "Datum wählen Birthday"

### Requirement: Picker — Clear

The `ClearTrigger` SHALL clear the value and every partial segment through the commit path (reason `CLEAR`) and focus the
field's first segment, also when the field is partially filled; it SHALL carry `data-empty` when there is no value and no draft and
SHALL be named by `messages.clear`.

#### Scenario: Partial field cleared (react-spectrum#9296)

- **WHEN** only the month is typed and the Clear trigger is pressed
- **THEN** every segment shows its placeholder and the first segment is focused

#### Scenario: Controlled null in every state (react-spectrum#9180)

- **WHEN** the parent sets `value={null}` while the popover is open
- **THEN** field, calendar and hidden input are empty and the popover stays open

### Requirement: Picker — Field And Form Participation

The Root SHALL act as a Field when not inside one, or register as one control inside a Field (the Control group as the labelled
element, the first segment as the focus target, the hidden input as the validity element), taking `disabled`, `readOnly`, `required`
and `invalid` from the Field; the embedded field SHALL NOT register. Focus within the Control or the content SHALL be "inside" for
touched and validation timing. The embedded field's validity (incomplete, impossible, out of range, unavailable) SHALL be the control's
own validity on the hidden input, and the effective invalid state SHALL be passed to the calendar. The hidden input SHALL follow the
Date Field's type mapping by value type and granularity, with `name`, `form`, `required`, `disabled`, `autoComplete`.

#### Scenario: Minute granularity submits (reka-ui#2398)

- **WHEN** a picker with `granularity="minute"` holds a `CalendarDateTime` inside a form and the form is submitted
- **THEN** the hidden input is `type="datetime-local"` with `step="60"`, no validation error is raised and the value is submitted

#### Scenario: Required empty

- **WHEN** a required picker is empty and the form is submitted
- **THEN** submission is cancelled and focus is on the first segment

#### Scenario: Invalid reaches the calendar

- **WHEN** the typed date is unavailable and the popover is opened
- **THEN** the calendar root has `data-invalid`

### Requirement: Picker — State Kept Until Exit

The calendar's focused date, visible range and view state SHALL be reset only when the popover opens; while the content is
exiting (presence) it SHALL keep the state it had.

#### Scenario: No flash on close (zag#3188)

- **WHEN** the user pages to another month and closes the popover with an exit animation
- **THEN** the exiting content keeps showing that month until it unmounts

### Requirement: Picker — Touch

Selecting SHALL act on press release; the popover SHALL unmount only after the press completed so the synthesised click cannot reach
elements beneath; opening with a focused segment SHALL move focus into the content, dismissing the soft keyboard; segments SHALL be
`inputMode="numeric"` text inputs (date-segments); the trigger and cells SHALL be at least 24 × 24 CSS px.

#### Scenario: Soft keyboard dismissed

- **WHEN** on a touch device a segment is focused and the trigger is tapped
- **THEN** focus moves to the calendar and the segment is blurred

### Requirement: Picker — Data Attributes

Root, Control, Input and Segment SHALL carry Date Field's attributes; Trigger, Positioner and Content SHALL carry the Popover's
attributes with `data-scope="date-field"` (`data-state`, `data-side`, `data-align`, `data-modal`, `data-nested`, `data-close-reason`);
Trigger and ClearTrigger SHALL carry `data-disabled`, `data-pressed` and focus attributes; every part SHALL carry `data-part` and
`data-instance`. `data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: Re-scoped popover parts

- **WHEN** a picker is open
- **THEN** the positioner and content carry `data-scope="date-field"` and the same `data-instance` as the trigger

### Requirement: Picker — Picker Invariants

The contract fragment SHALL ship invariants checked after every model step: field, calendar (when mounted) and hidden input agree on the
value (calendar by date, hidden input by ISO string or `""`); the trigger's `aria-expanded` equals the open state; open content is a `dialog`
with a non-empty name; `onValueChange` was called exactly as often as the value changed; `onOpenChange` exactly as often as the open state
changed by request; after a close, focus is on the trigger or on an element the user moved focus to, never on `body`; no pending date exists.

#### Scenario: Broken variant holds a date aside

- **WHEN** a broken variant keeps a picked date out of the value until a time is typed
- **THEN** the pick step fails naming the "views agree" invariant

### Requirement: Picker — Range: Committing A Range

Pressing a first date in the calendar SHALL set the range Calendar's anchor and SHALL NOT change the value or close the popover;
pressing a second date SHALL commit `{ start, end }` through the commit path and, with `closeOnSelect` (default `true`), close the
popover with reason `"select"`. Each end of the committed range SHALL keep the current value's time and zone for that end, else
`placeholderValue`'s time, else 00:00 at granularity ≥ hour; the commit SHALL be immediate with no date held aside. Hovering or moving the
pointer SHALL never commit or close. After a commit, the next press on any date, including the previous end, SHALL start a new
anchor. Two presses on the same date SHALL commit a one-day range.

#### Scenario: First press keeps it open

- **WHEN** the popover is open and the user presses 12 October
- **THEN** the popover is open, the value is unchanged and the anchor is 12 October

#### Scenario: Range commits and closes

- **WHEN** the user presses 12 October and then 16 October
- **THEN** `onValueChange` is called once with 12–16 October, the fields show both dates, the popover closes with reason `"select"`
  and the trigger is focused

#### Scenario: Time granularity fills the fields (react-spectrum#7688, react-spectrum#6957)

- **WHEN** no value is set, `granularity="minute"`, `closeOnSelect={false}` and the user presses 12 and 16 October
- **THEN** both ends show their date at 12:00 AM and the value holds two `CalendarDateTime`s

#### Scenario: Quick pointer moves do not close (ark#2509)

- **WHEN** after the first press the pointer sweeps quickly over many dates
- **THEN** the popover is open and the value unchanged

#### Scenario: Press on the old end (reka-ui#2242)

- **WHEN** the value is 12–16 October and the user opens the popover and presses 16 October
- **THEN** 16 October is the anchor, the value is unchanged and the popover is open

#### Scenario: One-day range (reka-ui#1020)

- **WHEN** the user presses 14 October twice
- **THEN** the value is 14–14 October

### Requirement: Picker — Range: Cancel And Leave

The picker SHALL force the range Calendar's `commitOnBlur` to `"reset"` when the popover closes
(a preview is never committed by closing); `commitOnBlur` on the picker applies only to focus
leaving the calendar while the popover stays open. While the range Calendar is anchored, the first Escape SHALL clear the anchor and be consumed (the popover stays open); a second
Escape SHALL close the popover with reason `"escape-key"`. Closing the popover by an outside press, by Tab leaving, by the trigger or
by the API while anchored SHALL reset the anchor and keep the previous value; it SHALL NOT commit a preview. The Control and the content
SHALL be inside; a layer opened from the calendar's header SHALL be inside and SHALL keep the anchor. One press SHALL close at most one
layer, including a host Dialog.

#### Scenario: Escape twice

- **WHEN** the anchor is set and Escape is pressed twice
- **THEN** after the first the popover is open without an anchor, after the second it is closed

#### Scenario: Outside press resets (react-spectrum#5709, react-spectrum#8850)

- **WHEN** the value is 1–5 October, the user sets the anchor on 12 October and presses outside the popover
- **THEN** the popover closes, the value is still 1–5 October and no anchor remains

#### Scenario: Host dialog survives (react-spectrum#9469)

- **WHEN** the picker is open inside a dismissible Dialog with an anchor set and the user presses on the Dialog's backdrop area
- **THEN** only the picker closes (reason `"outside-press"`) and the Dialog stays open

#### Scenario: Header select is inside (react-spectrum#9430)

- **WHEN** a Select in the calendar's header is opened while anchored and an option is chosen
- **THEN** the picker stays open and the anchor is kept

### Requirement: Picker — Range: Resume

When the popover opens while the pair has a committed start and an empty or invalid end, the range Calendar's anchor SHALL be that start
and its focused date the start, so the next press sets the end. Otherwise it SHALL open with no anchor and focus the start of the value, else
today constrained to `minValue`/`maxValue`.

#### Scenario: Start typed, then open

- **WHEN** the user types a start of 12 October, leaves the end empty and opens the popover
- **THEN** 12 October is the anchor and pressing 16 October commits 12–16 October

#### Scenario: Complete value

- **WHEN** the value is 12–16 October and the popover opens
- **THEN** there is no anchor and 12 October is focused

### Requirement: Picker — Range: Typing And Clearing

While the popover is open, committed field changes SHALL update the calendar's range and focused date; an incomplete or invalid pair SHALL
make the value `null` and clear the calendar's range without closing. The `ClearTrigger` and a controlled `null` SHALL clear both ends,
every partial segment, the calendar's range and anchor, in every state.

#### Scenario: Reset button inside the popover (react-spectrum#9180)

- **WHEN** a consumer button inside the content sets the picker's value to `null`
- **THEN** both ends of the field and the calendar are empty

#### Scenario: Programmatic clear (reka-ui#1891)

- **WHEN** a range is shown and the parent sets `value={null}`
- **THEN** every segment of both ends shows its placeholder

### Requirement: Picker — Range: Names Announcements And Form

The dialog SHALL be named by the Trigger's name and the Label; the range Calendar's prompts and polite announcements (anchor set,
range selected) SHALL be spoken while the popover is open; after a commit the focused Trigger's description SHALL read
Range Mode' range description. The two hidden inputs SHALL carry `startName`/`endName` ISO values only for a valid range, else `""`.

#### Scenario: Range spoken on the trigger

- **WHEN** a range is committed and the popover closes
- **THEN** the trigger's description contains "Selected range: Monday, October 12, 2026 to Friday, October 16, 2026"

#### Scenario: Two names

- **WHEN** the value is 12–16 October with `startName="from"` and `endName="to"` in a form
- **THEN** the form data has `from=2026-10-12` and `to=2026-10-16`

### Requirement: Picker — Range: Range Validity

Range validity SHALL be Range Mode' (per end, end before start, an unavailable day inside the range unless
`allowsNonContiguousRanges`); the effective invalid state SHALL be passed to the range Calendar; a range chosen in the calendar SHALL never
be invalid by those rules because the range Calendar already bounds it.

#### Scenario: Calendar and field agree (react-spectrum#5302)

- **WHEN** weekends are unavailable and a range crossing one is typed
- **THEN** the field is invalid and the open calendar root has `data-invalid`; the same range cannot be selected in the calendar

