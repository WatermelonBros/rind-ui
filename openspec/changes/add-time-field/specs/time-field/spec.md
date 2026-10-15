## Purpose

Defines rind-ui's Time Field: a labelled group of editable time segments (hour, minute, second,
day period, time zone) following `date-segments`, whose value is a `Time` or the time part of a
date-time, wired into Field validation and HTML forms. Introduced by `add-time-field`.

## ADDED Requirements

### Requirement: Date Field Parity

The Time Field SHALL have Date Field's anatomy, group semantics and value description, Field
integration, disabled and read-only rules, messages, data attributes and theme rules (scope
`time-field`), with `date-segments` behaviour limited to segments from `hour` to its
granularity, except where this specification differs.

#### Scenario: Standalone time field

- **WHEN** a Time Field labelled "Alarm" is rendered in `en-US`
- **THEN** there is one element with role `group` named "Alarm" containing spinbuttons named
  "hour Alarm", "minute Alarm" and "AM/PM Alarm" (the locale's display name for the day period)

### Requirement: Value And Time Types

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of
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

### Requirement: Hour Cycles

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

### Requirement: Day Period

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

### Requirement: Time Zones And Daylight Saving

A `ZonedDateTime` value SHALL show its time zone name as a read-only segment unless
`hideTimeZone`. Stepping the hour SHALL use the value's zone, so on a fall-back day both
occurrences of the repeated hour are reachable in order and on a spring-forward day the skipped
hour is not offered. Typing an hour that does not exist on that day SHALL resolve to the later
valid time, as `ZonedDateTime` does.

#### Scenario: Repeated hour

- **WHEN** the value is 2026-11-01 00:30 in `America/New_York` and ArrowUp is pressed on the
  hour twice
- **THEN** the field shows 1:30 AM with the EDT offset, then 1:30 AM with the EST offset

### Requirement: Form Value

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

### Requirement: Contract

The Time Field SHALL ship a contract with scope `time-field` with Date Field's actions, queries,
states and traits, `fill(time)` typing segments in the locale's order (including the day period
as "a"/"p"), and an extra action `setDayPeriod("am" | "pm")` (keyboard: focus the day period and
type the letter; pointer: click it and type); its invariants SHALL be Date Field's segment
invariants plus: no hour edit step changed the day period, and the hidden input's value equals
the oracle's ISO time or "".

#### Scenario: Driver fills a 12-hour time

- **WHEN** `getTimeField(screen, { name: "Alarm" }).fill("21:05")` runs in `en-US`
- **THEN** the segments show 9:05 PM and `value()` is "21:05"

### Requirement: Theme

`@rind-ui/theme` SHALL style the Time Field in `time-field.css` as family `field` with
`--rind-time-field-*` tokens defaulting to the semantic tokens Date Field uses, the same focus,
placeholder, invalid and forced-colors rules, and tabular numerals.

#### Scenario: Same look as Date Field

- **WHEN** a Date Field and a Time Field are rendered side by side with no token overrides
- **THEN** their height, boundary, radius and focus ring are identical
</content>
</invoke>
