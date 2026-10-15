## Purpose

Defines the date and time foundation every rind-ui date component shares (Calendar, Range
Calendar, Date Field, Time Field and the pickers built on them): value types, calendar systems,
the injected clock and "today", the locale's week, formatting, constraints and serialisation.
Introduced by `add-calendar`.

## ADDED Requirements

### Requirement: Date Value Types

rind-ui SHALL represent dates and times only with the immutable `@internationalized/date`
types `CalendarDate`, `CalendarDateTime`, `ZonedDateTime` and `Time`, re-exported from
`@rind-ui/core` together with their parse functions. No date component SHALL accept or emit a
JavaScript `Date`, and no date arithmetic SHALL go through a `Date` or the host's local time
zone; a `Date` is created only to format a value with `Intl`, in the value's own zone.

#### Scenario: Time typed in a time-only field (zag#3187)

- **WHEN** a component holding a `Time` of 00:00 is used by a viewer in `Asia/Tokyo`
- **THEN** the emitted value is `Time(0, 0)`, not shifted by the viewer's UTC offset

#### Scenario: Grid without local Date arithmetic (bits-ui#768)

- **WHEN** a calendar for November 2024 is built in a host zone with a DST change that month
- **THEN** 2 December 2024 is in the Monday column

### Requirement: Values Keep Their Type, Calendar And Time

A date component SHALL emit values of the same type and calendar system as its current value,
else its `defaultValue`, else `placeholderValue`, else a gregorian `CalendarDate`. Choosing a
date for a value that has a time of day (`CalendarDateTime`, `ZonedDateTime`) SHALL keep that
time and zone. The calendar system used for display SHALL never change the emitted calendar.

#### Scenario: Time kept on date selection (bits-ui#1358)

- **WHEN** a calendar whose value is `CalendarDateTime(2026, 10, 14, 9, 30)` has 20 October
  selected
- **THEN** the new value is `CalendarDateTime(2026, 10, 20, 9, 30)`

#### Scenario: Buddhist display, gregorian value

- **WHEN** a calendar with locale `th-TH` (buddhist display) and no value has a date selected
- **THEN** the emitted value is a gregorian `CalendarDate`, and the grid showed the buddhist
  year

### Requirement: Calendar Systems

The display calendar system SHALL be the one the locale resolves to (its `-u-ca-` extension
or the locale's default). `@rind-ui/core` SHALL bundle only the gregorian system; other
systems SHALL be available when the consumer passes a `createCalendar` function (the one
exported by `@internationalized/date`, or a subset). When the locale's system is not available
or not supported, the component SHALL use gregorian and report a development warning naming
the system, and SHALL never throw.

#### Scenario: Persian locale

- **WHEN** a calendar with locale `fa-IR` and `createCalendar` is rendered for 14 October 2026
- **THEN** the heading names Mehr 1405 and the cells use the Persian calendar's month length

#### Scenario: Unsupported system (react-spectrum#8017)

- **WHEN** a calendar is rendered with locale `zh-CN-u-ca-chinese`
- **THEN** it renders a gregorian month, nothing throws, and a development warning names
  `chinese`

#### Scenario: No createCalendar

- **WHEN** a calendar with locale `ja-JP-u-ca-japanese` is rendered without `createCalendar`
- **THEN** it renders gregorian and warns once that the japanese calendar needs `createCalendar`

### Requirement: Date Clock And Today

The environment SHALL provide a date clock capability with the current instant (epoch
milliseconds) and the viewer's time zone (the platform's resolved zone by default), which tests
replace with fixed values. "Today" for a component SHALL be the clock's instant in the first of:
the component's `timeZone` prop, the time zone of its `ZonedDateTime` value, the clock's zone.
No module SHALL read the current time at module scope or during server rendering outside the
clock.

#### Scenario: Today in the viewer's zone (ark#2270)

- **WHEN** the clock is 2026-10-14T23:30 UTC and the viewer's zone is `Pacific/Auckland`
- **THEN** the calendar marks 15 October as today

#### Scenario: Today in the value's zone

- **WHEN** the value is a `ZonedDateTime` in `America/Los_Angeles` and the clock is
  2026-10-15T03:00 UTC
- **THEN** 14 October is today

#### Scenario: Fake clock in tests

- **WHEN** a test creates an environment with a fixed clock of 2026-02-28
- **THEN** every date component in it treats 28 February 2026 as today

### Requirement: Week Data

The first day of the week SHALL be the locale's (CLDR week data) unless a `firstDayOfWeek`
prop names a weekday (`"sun"` … `"sat"`). The value SHALL be a weekday name, never an index,
and the same first day SHALL be used for weekday headers, the number of rows and week-edge
navigation. Weekend days SHALL come from the locale.

#### Scenario: Monday in two locales (reka-ui#2157, reka-ui#2264)

- **WHEN** `firstDayOfWeek="mon"` is set with locale `en-US` and with locale `cs-CZ`
- **THEN** both calendars start their weeks on Monday

#### Scenario: Row count follows the first day (zag#1208)

- **WHEN** a calendar shows a month whose first day is a Sunday with `firstDayOfWeek="mon"`
- **THEN** the month has as many rows as weeks counted from Monday

#### Scenario: Locale default

- **WHEN** no `firstDayOfWeek` is set and the locales are `en-US`, `en-GB` and `ar-EG`
- **THEN** the weeks start on Sunday, Monday and Saturday respectively

### Requirement: Formatting

Every date text SHALL be formatted with the component's locale, calendar system and time zone
through formatters cached per locale and options. A day number shown in a cell SHALL be the
`day` part of the formatted date only, without suffixes. A change of locale SHALL reformat
every text the component shows or exposes on its next render.

#### Scenario: Japanese day cell (react-spectrum#4135)

- **WHEN** a calendar with locale `ja-JP` renders 14 October
- **THEN** the cell's text is "14", not "14日"

#### Scenario: Locale change (ark#3725)

- **WHEN** the locale changes from `en-US` to `de-DE` with 14 October 2026 selected
- **THEN** the heading reads "Oktober 2026" and the cell's name is in German

### Requirement: Constraints

`minValue` and `maxValue` SHALL be inclusive, compared at the component's granularity (date
components compare dates only). `isDateUnavailable(date)` SHALL mark dates that cannot be
chosen but remain part of the calendar. Disabled (outside min/max, outside the visible month,
or the component disabled) and unavailable SHALL be distinct states with distinct attributes.

#### Scenario: Maximum date selectable (reka-ui#1455)

- **WHEN** `maxValue` is 31 October 2026 and the user selects 31 October
- **THEN** the selection succeeds

#### Scenario: Unavailable is not disabled (react-spectrum#6108)

- **WHEN** `isDateUnavailable` returns true for weekends
- **THEN** weekend cells carry `data-unavailable` and not `data-disabled`

### Requirement: Serialisation

Values SHALL serialise to ISO 8601 with their `toString()` (gregorian, with offset and zone
identifier for `ZonedDateTime`) wherever a component writes a value to the DOM (`data-value`,
hidden inputs) or a contract reads one.

#### Scenario: Data value of a buddhist cell

- **WHEN** a `th-TH` calendar renders the cell for 14 October 2026
- **THEN** its `data-value` is "2026-10-14"
</content>
</invoke>
