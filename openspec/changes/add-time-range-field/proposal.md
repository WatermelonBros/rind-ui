## Why

Opening hours, booking slots and quiet hours are two times that belong together. Reka UI and Bits UI ship a
Time Range Field; their traps (PM turned into AM when the hour is typed, bits-ui#1985; a PM period
misread in non-English locales, reka-ui#2956; the end rewriting the start, bits-ui#1348; one hidden input
with "undefined - undefined"; no way to express 22:00–06:00) are the Time Field's and the range field's, both
already specified. This change composes them and decides only what is specific to times: ordering and
overnight ranges.

Research: [time-range-field](../../../docs/research/time-range-field.md) ·
[time-field](../../../docs/research/time-field.md) · [date-range-field](../../../docs/research/date-range-field.md)

Depends on: `add-date-range-field` (`paired-fields`), `add-time-field` (Time Field behaviour per end), and
through them `add-date-field`, `add-calendar`, `add-field`, `add-checkbox`, `add-theme-system`; archived
foundations in `openspec/specs/`.

## What Changes

- A public **Time Range Field**: `Root` (a Field when not inside one), `Label`, `Description`,
  `ErrorMessage`, `Input`, `Start`, `End`, `Separator`, `Segment`, two automatic hidden inputs
  (`type="time"` for `Time` ends).
- Value `{ start: Time; end: Time } | null`; date-time and zoned ends keep their date and zone and are edited by
  time only; `granularity` hour/minute/second, `hourCycle`, `hideTimeZone`, `minValue`/`maxValue` as `Time`.
- Ordering: `end < start` is invalid unless `allowsOvernight` (plain `Time` ends), equal is valid; the value
  description says "ends the next day" for an overnight range.
- Contract and driver (`getTimeRangeField`), theme stylesheet (family `field`), stories, docs page.

## Capabilities

### New Capabilities

- `time-range-field`: the Time Range Field component — value and ordering, overnight, hidden inputs, names,
  contract, theme (everything else is `paired-fields` and Time Field behaviour).

### Modified Capabilities

None.

## Non-goals

- A popup time picker (reka-ui#2440), minute `step`, milliseconds, durations (Time Field's non-goals).
- Range ordering across dates for plain `Time` (use date-times).
- Framework adapters other than React; fx.

## Impact

- `packages/core/src/components/time-range-field/` (props mapping, ordering, contract, messages),
  `packages/react/src/time-range-field/`, `@rind-ui/testing` (`getTimeRangeField`),
  `@rind-ui/theme/time-range-field.css`, stories, docs.
- No new dependency. Reado: not used.
