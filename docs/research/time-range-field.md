# Time Range Field — research

Status: done · Wave: 3 (Reka UI `TimeRangeField`, Bits UI `TimeRangeField`; none of the others)

Read [date-range-field.md](date-range-field.md) (the `paired-fields` decision, bug history of pairing)
and [time-field.md](time-field.md) (hour cycles, day period, zones, DST, form value) first. Time
Range Field is their composition: two embedded Time Fields in a paired field. This note records
only what is specific: ordering of times, overnight ranges, value types, hidden inputs.

Cross-cutting: [accessibility.md](accessibility.md) §2, §6, §9; [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
§1.4 "Date fields", causes G, I, J; [native-platform.md](native-platform.md) §8, §14.

## Pattern

- No APG pattern. Closest: two time inputs in a labelled group (opening hours, a booking slot,
  quiet hours). Native: two `<input type="time">`.
- Perceivable without sight: which time is the start and which the end, the whole range
  ("Selected range: 9:00 AM to 5:30 PM"), and whether the range wraps past midnight.

## How the others built it

### Reka UI (`TimeRangeField/TimeRangeFieldRoot.vue`, `TimeRangeFieldInput.vue`)

- Same anatomy as `DateRangeField` (`Root`, `Input type=start|end`, `part`); values are `Time`
  (converted internally with `convertValue` onto a reference date). `isInvalid` = an end outside
  `minValue`/`maxValue`, or `end` not before-or-same as `start` (`isBeforeOrSame`) — **no overnight
  ranges**; one hidden input with `"${start} - ${end}"` and one `name`. Partial ranges are public.
  Added late (RK#2182, closed; `TimeRange` type not exported, RK#2589; TimePicker/TimeRangePicker
  requested, RK#2440, open).
- Problems: RK#2956 (day period resolved to AM when the locale's PM string is not "PM"/"pm"/"p.m.").

### Bits UI (`bits/time-range-field/time-range-field.svelte.ts`)

- Same as its Date Range Field with `TimeValue`s; `isInvalid` derived from the two ends.
- Problems: BITS#1985 (the hour typed in a 12-hour field always yields AM; same bug in Time Field).

### React Aria, Ark/Zag, Kobalte

React Aria has no range time field (a `TimeField` pair is user-composed); Kobalte ships a
Time Field only; Zag has no time input. A search of all nine trackers for "overnight",
"time range" and "TimeRangeField" found no overnight-range report: libraries simply reject
`end < start` (Reka) or do not validate (Bits).

## Accessibility

As Date Range Field: one `group` named by the Label, the end name in every segment's name
("hour, Start time, Shift"), a value description "Selected range: …", errors through the Field.
A range that wraps midnight is announced as such in the value description ("…, ends the next
day") when `allowsOvernight` is true, because "10 PM to 6 AM" otherwise sounds like an error.
iOS VO textbox quirk, forced colours, RTL isolates: Time Field's rules per end.

## Bug history

Searched (2026-10-14) all nine trackers for "TimeRangeField", "time range", "overnight"; the
component-specific hits are few; the instructive bugs come from the parts it composes and are
in [time-field.md](time-field.md) and [date-range-field.md](date-range-field.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| BITS | [#1985](https://github.com/huntabyte/bits-ui/issues/1985) | Time Range Field always returns AM when the hour is typed (2:00 PM + "1" → 1 AM) | hour edit rebuilt the value without the day period | closed | per-end scenario: typing the hour keeps the period of that end |
| RK | [#2956](https://github.com/unovue/reka-ui/issues/2956) | es-ES PM value shows AM; typing "3" gives 03:30 | day period compared with the strings "PM"/"pm"/"p.m." | closed | period from the locale's formatter parts (date-segments); end scenario in `es-ES` |
| RK | [#2589](https://github.com/unovue/reka-ui/issues/2589) | `TimeRange` type not exported while `DateRange` is | oversight | closed | export `TimeRangeValue` next to `DateRangeValue`; type test |
| RK | [#2182](https://github.com/unovue/reka-ui/issues/2182) / [#2440](https://github.com/unovue/reka-ui/issues/2440) | requests for TimeRangeField / TimePicker / TimeRangePicker | missing component | closed / open | Time Range Field ships; a popup time picker is a non-goal |
| RK | Reka source | invalid when `end` is not before-or-same as `start`, no way to express 22:00–06:00 | design | n/a | `allowsOvernight` (default false): when true `end < start` is valid and means the next day |
| RK | Reka source | hidden input `"undefined - undefined"`, one name | design | n/a | two `type="time"` inputs, `startName`/`endName` |
| BITS | [#1348](https://github.com/huntabyte/bits-ui/issues/1348) | typing the end rewrites the start | validity rule edited the other end | closed | validity only reports (date-range-field.md) |
| RK | [#1939](https://github.com/unovue/reka-ui/issues/1939) | range field cannot be cleared from the model | model `undefined` ignored | closed | controlled `null` clears both ends |
| RA | [#7348](https://github.com/adobe/react-spectrum/issues/7348) | granularity switch clears the entered date part | state initialised once | open | granularity change keeps drafts per end |
| BITS | [#2145](https://github.com/huntabyte/bits-ui/issues/2145) | editing hour then minutes turns 21:30 into 09:30 | 12-hour text reused as a 24-hour value | closed | already a time-field scenario; repeated for the end |

## Known pitfalls

- "Before" for plain `Time` has no date: 22:00 → 06:00 is either an error or a wrap; the user's
  intent differs per product, so it is a prop, default strict (matches Reka, Bits).
- For `CalendarDateTime` / `ZonedDateTime` ends the dates decide: `end < start` is always invalid
  (overnight is expressed by an end on the next day), and `allowsOvernight` does not apply.
- DST: a zoned range across a transition has a different duration than its wall-clock span;
  comparison uses `compare()` on zoned values (instants), not wall-clock.

## Testing notes

Date Range Field's plus: strict vs overnight ordering for `Time`, equal times valid, 12-hour typing
per end in `en-US`, `es-ES`, `ja-JP`, `ko-KR`; zoned ends across `America/New_York` 2026-11-01;
hidden `type="time"` values and `step`; model configuration with `allowsOvernight`.

## Decisions

- **Composition only**: `paired-fields` (add-date-range-field) over two embedded Time Fields
  (`maxGranularity: "hour"`); scope `time-range-field`; own parts, contract, driver, theme.
- **Value** `{ start: Time; end: Time } | null`; date-time/zoned ends keep their date and zone
  and are edited by time only (Time Field rule per end), `granularity` `hour | minute | second`
  (default `minute`), `hourCycle`, `hideTimeZone`, `minValue`/`maxValue` as `Time`.
- **Ordering**: `Time` ends compare by time; `end < start` is invalid ("End time must be after the
  start time") unless `allowsOvernight`, in which case it is valid and the description says it
  ends the next day; equal is valid. Date-time ends compare by `compare()`.
- **Hidden inputs**: two `type="time"` (`step` 3600/60/1, native `min`/`max`); date-time ends use
  Date Field's mapping.
- **Contract**: Date Range Field's with `fill({ start, end })` as times, `setDayPeriod(edge, …)`.
- **Deliberately different**: overnight is explicit; two names; both-or-neither value.

## Open questions

- `step` (minute increments) — Time Field's open question, inherited.
- A popup time picker (Reka #2440) is a different component.
