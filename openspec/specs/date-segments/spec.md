# date-segments Specification

## Purpose
Defines rind-ui's segmented date and time input: how a value is split into locale-ordered
editable segments, how each segment is typed, stepped, cleared and navigated, when edits become
the value, and which partial or impossible states are reported as invalid. Shared by Date
Field, Time Field and later Date Range Field, Time Range Field and the Date Picker input;
introduced by `add-date-field`.
## Requirements
### Requirement: Segment List

The segments SHALL be the parts the locale's formatter produces for the value (or the
placeholder value) with the component's calendar system, granularity, hour cycle, time zone
display and leading-zero option, in the formatter's order: editable `era` (only when the
calendar has more than one era or a gregorian date is BC), `year`, `month`, `day`, `hour`,
`dayPeriod` (12-hour cycles only), `minute`, `second`, a read-only `timeZoneName` (for
`ZonedDateTime` values unless `hideTimeZone`), and `literal`s between them. A formatter part
named `relatedYear` SHALL be a `year`; any other unknown part SHALL be a literal. With
`hideTimeZone`, the time zone and the literals that only surround it SHALL be omitted. A change
of locale, calendar, granularity or hour cycle SHALL recompute the list, keep every segment's
value and keep focus on the segment of the same type.

#### Scenario: Day-first locale

- **WHEN** a date field with locale `en-GB` is rendered
- **THEN** its editable segments are day, month, year in that order, separated by "/"

#### Scenario: Locale change keeps focus order right (reka-ui#1127)

- **WHEN** the locale changes from `en-GB` to `en-US` while the month segment is focused
- **THEN** the segments are month, day, year, the month segment is still focused, and Tab moves
  to the day

#### Scenario: Hidden zone without brackets (reka-ui#2356)

- **WHEN** a zoned time is shown with `hideTimeZone` in locale `zh-TW`
- **THEN** no empty bracket or trailing literal remains after the last time segment

### Requirement: Segment Elements

Each editable segment SHALL be a native `<input type="text">` with `role="spinbutton"`,
`inputMode="numeric"` for numeric segments (`text` for `era` and `dayPeriod`),
`autoComplete="off"`, `autoCorrect="off"`, `spellCheck=false`, `enterKeyHint="next"` and a
`size` equal to the segment's longest value; its `value` SHALL be the segment's displayed text.
Literals SHALL be `aria-hidden` text elements and never focusable. The read-only `timeZoneName`
SHALL be a read-only input without the `spinbutton` role. The component SHALL NOT use
`contenteditable` and SHALL NOT read or change the document selection outside the focused
segment input.

#### Scenario: No focus theft in Firefox (react-spectrum#10259, react-spectrum#10387)

- **WHEN** in Firefox the user edits a segment, then clicks a text input elsewhere and types
- **THEN** every typed character lands in the text input and focus never returns to the segment

#### Scenario: Non-numeric text rejected (bits-ui#1988)

- **WHEN** the user types or drops "abc12345" into the day segment in Safari
- **THEN** the segment shows at most two digits and no letters

### Requirement: Segment Names And Values

Each editable segment SHALL be named by its segment name followed by the field's label
(`aria-labelledby` the segment-name node and the label), where the segment name is the
locale's display name for that field type (`Intl.DisplayNames` with type `dateTimeField`)
unless `messages.segmentName` overrides it. It SHALL carry `aria-valuemin`/`aria-valuemax` for
the segment's current limits, `aria-valuenow` when it has a value (absent when empty) and
`aria-valuetext` from `messages.segmentValueText` (default: the formatted value — the month as
"10 – October" when the month is numeric, the hour in its cycle with the day period, "Empty"
when empty), updated in the same task as the change. Only the first editable segment SHALL
carry the field's description ids, unless the field is invalid, when every segment carries
them and `aria-invalid="true"`. Under the `ios-vo-spinbutton-input` quirk the segments SHALL be
rendered without the `spinbutton` role and value attributes. No segment SHALL carry
`aria-roledescription`.

#### Scenario: Month segment name and value

- **WHEN** an `en-US` date field labelled "Birthday" shows October in its month segment
- **THEN** the month segment's name is "month Birthday", `aria-valuenow` is 10 and
  `aria-valuetext` is "10 – October"

#### Scenario: Script subtag respected (zag#3154)

- **WHEN** the locale is `sr-Latn-RS`
- **THEN** segment names and placeholders are in Latin script

#### Scenario: Unknown part does not crash (react-spectrum#8017)

- **WHEN** the formatter returns a `relatedYear` part
- **THEN** it is an editable year segment and no error is thrown

### Requirement: Partial Values And Limits

Each editable segment SHALL hold its own value or be empty, independently of the committed
value. While the segments do not yet form a complete date, a segment's limits SHALL be the
calendar's maxima (day up to the maximum days in any month, month up to the calendar's maximum
months); once complete, the day's limit SHALL be the month's length. Typing or stepping SHALL
never change another segment's value, never clamp a segment to `minValue`/`maxValue`, and never
change the day because of a month or year typed later.

#### Scenario: Day 31 before the month (react-spectrum#3256, react-spectrum#9586, bits-ui#1899)

- **WHEN** the user types "3","1" into the empty day segment of an `en-GB` field
- **THEN** the day shows "31" and focus moves to the month

#### Scenario: Leap day while typing the year (react-spectrum#5965)

- **WHEN** the user types 02/29 and then "2","0","2","4" in an `en-US` field
- **THEN** the day stays 29 at every keystroke and the value becomes 29 February 2024

#### Scenario: Minimum does not rewrite other segments (zag#3070)

- **WHEN** `minValue` is 1 January 2000 and the user types 02/22/1 into an `en-US` field
- **THEN** the month and day still show 02 and 22

### Requirement: Typing And Auto-Advance

Typing into a numeric segment SHALL accept digits in the locale's numbering system and in Latin
and full-width forms (`number-parsing`) and SHALL reject any other insertion before it changes
the input. The segment SHALL show exactly the typed digits while it is focused, including
leading zeros. Focusing a segment SHALL start a new buffer, so the first digit replaces the
shown value. After each digit, focus SHALL advance to the next editable segment in format order
when no further digit can keep the buffer within the segment's limit, or the buffer has the
limit's digit count. A digit typed into a full buffer of the last segment SHALL be ignored.
Typing the locale's separator literal (or "/", "-", ".", ":" and space) in a non-empty segment
SHALL advance.

#### Scenario: Leading zero shown and advancing (react-spectrum#6004, react-spectrum#8637)

- **WHEN** the user types "0" into the month segment, then "1"
- **THEN** after "0" the segment shows "0" and keeps focus, and after "1" it shows "01" and
  focus moves to the day

#### Scenario: Year with a leading zero (react-spectrum#9952)

- **WHEN** the user types "0","2","0","2","6" into the year segment
- **THEN** the segment shows "0202" after the fourth digit, focus has left it, and the fifth
  digit lands in the next segment or is ignored in the last one

#### Scenario: Retyping a filled segment (react-spectrum#8366, reka-ui#2567)

- **WHEN** the year shows 2026, the user focuses it and types "1","9","9","0"
- **THEN** the year is 1990

#### Scenario: Full-width digits (react-spectrum#3739)

- **WHEN** a Japanese IME commits "１２" into the month segment
- **THEN** the month is 12

#### Scenario: Separator advances (react-spectrum#5364)

- **WHEN** the user types "3" then "/" in the month segment of an `en-US` field
- **THEN** the month is 3 and focus is on the day

#### Scenario: Last segment does not overwrite (reka-ui#2002)

- **WHEN** the year is complete and focused as the last segment and the user types "7"
- **THEN** the year is unchanged

### Requirement: Day Period And Era Typing

The `dayPeriod` segment SHALL be set by typing the first characters of the locale's AM or PM
name until they match only one (compared with the locale's base-sensitivity collation, after an
IME composition ends), and in every locale by the Latin letters "a" and "p" in either case; a
match SHALL commit the segment and advance. The `era` segment SHALL be set by typing the start
of an era name (after removing a prefix common to all names). Day-period and era names SHALL be
derived from the formatter's parts, never compared with English strings.

#### Scenario: Korean day period (react-spectrum#5832)

- **WHEN** a `ko-KR` user composes "오후" in the day-period segment
- **THEN** the day period is PM after the composition ends, and focus did not move after the
  first syllable

#### Scenario: Lowercase letter (reka-ui#980)

- **WHEN** the user types "p" in the day-period segment of an `en-US` field showing AM
- **THEN** the day period and the committed value are PM

### Requirement: Stepping Keys

ArrowUp/ArrowDown SHALL increase/decrease the focused segment by one, wrapping within its
limits without carrying into another segment; PageUp/PageDown SHALL step by a larger amount
(year 5, month 2, day 7, hour 2, minute 15, second 15); Home/End SHALL set the segment's minimum
/ maximum (12-hour hour: Home 12, End 11). Stepping an empty segment SHALL first set it to the
placeholder value's part. Stepping SHALL commit immediately. Stepping a date segment of a
`ZonedDateTime` SHALL keep the wall-clock time; stepping the hour SHALL use zoned arithmetic so
both occurrences of a repeated hour are reachable and a skipped hour is skipped. Enter SHALL
never change a segment and SHALL submit the form as native inputs do. Keys SHALL be ignored
while an IME composes.

#### Scenario: Month step across DST (react-spectrum#10776)

- **WHEN** a `ZonedDateTime` field in `Europe/Lisbon` shows 14 October 2026 09:44 and the
  month is stepped up
- **THEN** the value is 14 November 2026 09:44

#### Scenario: Enter does nothing to the segment (reka-ui#1993, reka-ui#2005)

- **WHEN** the minute segment is focused and Enter is pressed inside a form
- **THEN** the minute is unchanged and the form is submitted

#### Scenario: Wrap without carry (react-spectrum#6590)

- **WHEN** the second segment shows 59 and ArrowUp is pressed
- **THEN** it shows 00 and the minute is unchanged

### Requirement: Backspace And Clearing

Backspace and Delete in a non-empty segment SHALL remove its last typed digit (a non-numeric
segment is cleared), clearing the segment when none remain; in an empty segment Backspace SHALL
move focus to the previous editable segment without changing it. Clearing one segment SHALL
never clear another. Selecting all (⌘/Ctrl+A) in a segment followed by Backspace or Delete SHALL
clear every segment. Clearing SHALL reset the segment's buffer.

#### Scenario: Deleting the year keeps the rest (reka-ui#1639)

- **WHEN** the field shows 10/14/2026 and the user clears the year
- **THEN** the month and day still show 10 and 14

#### Scenario: Back to the previous segment (reka-ui#1758)

- **WHEN** the day segment is empty and focused and Backspace is pressed
- **THEN** focus moves to the month segment and the month is unchanged

#### Scenario: Retyping after a clear (react-spectrum#5223)

- **WHEN** the user clears the minutes with Backspace and types "2","3"
- **THEN** the minutes are 23

### Requirement: Moving Between Segments

Tab and Shift+Tab SHALL move through every editable segment. ArrowRight/ArrowLeft SHALL move
to the visually adjacent editable segment (by rendered position, so they follow what the user
sees in either direction). Auto-advance SHALL follow format order. A press on the group outside
any segment SHALL focus the last non-empty segment before the press point, else the first
editable segment; a press on the Label SHALL focus the first editable segment. Focus SHALL move
after the keystroke's commit is applied, never in the same handler that changes the value.
When auto-advance, Backspace in an empty first segment, ArrowRight or ArrowLeft finds no adjacent
editable segment, the machine SHALL call `onBoundary({ direction: "next" | "previous", reason:
"advance" | "backspace" | "arrow" })` (default: nothing) and focus SHALL stay where it is. The
segment layout's `adjacent(type, direction, scope?)` SHALL take an optional `scope` element, and
visual adjacency SHALL then be computed over every segment inside it, so a host rendering two
fields in one row can move between them (`paired-fields`).

#### Scenario: RTL auto-advance (reka-ui#2812)

- **WHEN** an `en-US` field has `dir="rtl"` and the user types "2" in the month segment
- **THEN** focus moves to the day segment

#### Scenario: Boundary event at the last segment

- **WHEN** the year segment is the last editable segment and the user types its final digit
- **THEN** the year is committed, focus stays on it and `onBoundary` is called with direction
  `next` and reason `advance`

#### Scenario: Backspace in the first empty segment

- **WHEN** the month segment is first, empty and focused and Backspace is pressed
- **THEN** `onBoundary` is called with direction `previous` and reason `backspace`, and nothing
  is cleared

#### Scenario: Adjacency across a scope

- **WHEN** two embedded fields sit in one row inside a scope element and ArrowRight is pressed
  in the last segment of the first
- **THEN** the layout reports the first segment of the second as adjacent, and with no scope it
  reports none and `onBoundary` is called with reason `arrow`

#### Scenario: Keystroke not lost on advance (react-spectrum#10683)

- **WHEN** a day is completed by the keystroke that also moves focus out of the field
- **THEN** the value reflects that keystroke

### Requirement: Commit Points

Edits SHALL become part of the value only at commit points: auto-advance out of a segment (or
the buffer becoming full in the last segment), focus leaving a segment, a separator key, a stepping key, a day-period or era match, paste, and
Enter. Typing digits inside a segment SHALL NOT change the value. At a commit point, when every
editable segment has a value and they form a real date, the value SHALL become that date (in
the value's type, calendar and zone) if it differs by `compare()`; otherwise the value SHALL
become `null` if it was not. `onValueChange` SHALL be called once per change, with
`details.reason` (`SEGMENT.COMMIT`, `STEP`, `PASTE`, `CLEAR`, `RESET`).

#### Scenario: Typing a year emits once

- **WHEN** the user types "2","0","2","6" into the year of a field showing 10/14/
- **THEN** `onValueChange` is called once, with 14 October 2026

#### Scenario: Time-only changes are not swallowed (zag#3117)

- **WHEN** a field with minute granularity changes from 09:30 to 09:45 on the same day
- **THEN** `onValueChange` is called with the new time

### Requirement: Validity

The field SHALL report, as the control's own validity on its validity element: `badInput` when
some but not all editable segments have values (incomplete), or when all have values that form
no real date (31 February); `rangeUnderflow` / `rangeOverflow` when the date is before
`minValue` / after `maxValue`; and a custom error when `isDateUnavailable(value)`; with messages
from `messages` (defaults "Enter a complete date", "Enter a valid date", "Value must be {min}
or later", "Value must be {max} or earlier", "This date is unavailable"). An impossible or
incomplete entry SHALL NOT be changed into another date, on blur or otherwise; its segments SHALL
keep their text. A field whose editable segments are all empty SHALL be valid unless
`required` (`valueMissing`).

#### Scenario: Impossible date kept and reported (react-spectrum#9624)

- **WHEN** the user types 02/31/2026 and tabs away
- **THEN** the segments still show 02/31/2026, the value is `null`, and the field reports
  `badInput` with "Enter a valid date"

#### Scenario: Any partial clear is invalid (react-spectrum#9958)

- **WHEN** a required field with a full date has its month cleared, then is restored and has
  its day cleared
- **THEN** both times the value is `null` and the field reports `badInput`

#### Scenario: Unavailable typed date (react-spectrum#4848)

- **WHEN** `isDateUnavailable` excludes weekends and the user types Saturday 17 October 2026
- **THEN** the value is 17 October 2026 and the field is invalid with "This date is unavailable"

### Requirement: Paste And Copy

Pasting into any segment SHALL replace the whole field when the text parses as an ISO 8601
date, date-time or time matching the field's value type, or as the field's own formatted output
in its locale (digits in the locale's numbering system); the result is committed. Any other
pasted text SHALL be ignored. Copying (⌘/Ctrl+C or the copy command) from a segment SHALL copy
the whole field's formatted text when the field is complete, else the segment's text.

#### Scenario: Paste an ISO date (react-spectrum#5285, reka-ui#1897)

- **WHEN** "2026-10-14" is pasted into the day segment of an `en-GB` field
- **THEN** the field shows 14/10/2026 and the value is 14 October 2026

#### Scenario: Paste the locale format

- **WHEN** "14.10.2026" is pasted into a `de-DE` field
- **THEN** the value is 14 October 2026

### Requirement: Controlled Value, Reset And Clearing

A controlled value change (including `null`) SHALL replace every segment's value and buffer,
even while a segment is focused, and focus SHALL stay on that segment. A form reset SHALL
restore the current default value and clear partial segments. A partially filled field SHALL be
clearable by setting `null` or by reset.

#### Scenario: External clear while focused (bits-ui#2174, reka-ui#1426)

- **WHEN** a segment is focused and the parent sets the value to `null`
- **THEN** every segment shows its placeholder and the segment keeps focus

#### Scenario: Reset a partial field (react-spectrum#9366)

- **WHEN** only the hour of a field without a default value is filled and the form is reset
- **THEN** every segment is empty and the field is valid

### Requirement: Placeholders

An empty segment SHALL show `messages.placeholder(type)` (English defaults: "yyyy", "mm", "dd",
"––" for time segments, "AM" for the day period) and carry `data-placeholder`; the shown text
SHALL be the input's `placeholder` so it is never taken as a value. `placeholderValue` (default:
today constrained to the bounds, at 00:00 for time segments) SHALL be the value stepping starts
from.

#### Scenario: Placeholder letters are translatable (zag#3420)

- **WHEN** `messages={{ placeholder: (t) => ({ year: "jjjj", month: "mm", day: "tt" })[t] }}`
  is set in `de-DE`
- **THEN** the empty field shows "tt.mm.jjjj"

### Requirement: Right-To-Left Rendering

Numeric segments SHALL have `dir="ltr"`; the hour-to-second run of time segments SHALL be
isolated (U+2066 … U+2069 literals) so it reads hour:minute in any direction; the group SHALL
isolate itself from surrounding bidi text; segment DOM order SHALL be format order. Layout
SHALL NOT reorder segments visually.

#### Scenario: Arabic date-time order (react-spectrum#4711)

- **WHEN** a date-time field is rendered in `ar-AE`
- **THEN** the segments appear in the order `Intl.DateTimeFormat` produces for `ar-AE` and the
  time reads hour:minute

### Requirement: Server Rendering

Segment and part ids SHALL derive from the component's root id (`element-ids`) so every IDREF
resolves on the server and after streaming hydration. Attributes SHALL NOT depend on the
platform on the first render; platform quirks SHALL apply after mount. Literal text MAY differ
between the server's and the browser's formatter; literal elements SHALL be corrected on the
client without a hydration warning, and nothing else SHALL.

#### Scenario: Labelled segments after streaming (react-spectrum#9675)

- **WHEN** a field is streamed from the server and hydrated
- **THEN** every segment's `aria-labelledby` ids exist in the document

#### Scenario: Engine-specific space before AM/PM (react-spectrum#7169)

- **WHEN** an `en-US` time is rendered on a server whose formatter uses U+0020 and hydrated in
  Safari, which uses U+202F
- **THEN** no hydration warning is reported and the client shows Safari's text
</content>
</invoke>

