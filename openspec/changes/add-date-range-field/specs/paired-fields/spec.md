## Purpose

Defines the shared behaviour of a start/end pair of segmented fields: how two embedded Date Field
instances become one Field control with one derived range value, how the pair is validated without
editing either end, how focus and names work across the ends and how the two hidden inputs take part
in forms. Used by Date Range Field, Time Range Field and the Date Range Picker's input. Introduced by
`add-date-range-field`.

## ADDED Requirements

### Requirement: One Control, Two Embedded Fields

A pair SHALL consist of two embedded Date Field instances (`start`, `end`) driven by one coordinator.
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

### Requirement: Derived Value

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

### Requirement: Ends Never Edit Each Other

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

### Requirement: Range Validity

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

### Requirement: Focus Between Ends

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

### Requirement: Names And Description

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

### Requirement: Hidden Inputs And Form

The pair SHALL render two hidden native inputs (`hidden-form-input`), `startName` and `endName`, of the type
Date Field declares for the value type (and Time Field for times), each with the ISO value of its end **only
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

### Requirement: Controlled Value, Clear And Reset

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

### Requirement: Granularity And Locale Changes

A change of `granularity`, `hourCycle`, locale or calendar SHALL recompute the segments of both ends, keep every
segment's value and keep focus on the segment of the same type and end.

#### Scenario: Granularity switch keeps the date (react-spectrum#7348)

- **WHEN** both ends have dates, `granularity` changes from `day` to `minute` and the user types an hour into
  the start
- **THEN** the start's date is unchanged

### Requirement: Pair Invariants

The contract fragment SHALL ship invariants checked after every model step: the public value equals the value derived
from the two ends' committed values; no step changed a segment of an end other than the one edited, cleared or
adopted; exactly two hidden inputs exist, neither ever focused; each hidden input's value equals the oracle's end
ISO string only when the value is a range, else `""`; every `aria-labelledby`/`aria-describedby` id resolves; exactly one
Field registration; `onValueChange` was called exactly as often as the derived value changed.

#### Scenario: Broken coordinator pushes the start back

- **WHEN** a broken variant rewrites the start when the end becomes earlier
- **THEN** the step fails naming the "other end untouched" invariant
