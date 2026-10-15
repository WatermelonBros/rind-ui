## Why

Times are typed in schedulers, reminders and date-time pickers, and the Time Range Field and
Date Picker's time input will reuse this component. Time adds its own trap set on top of the
segmented date input: four hour cycles, a day period whose name differs per locale ("p. m.",
"午後", "오후") and that libraries keep flipping from PM to AM (react-spectrum#6793,
bits-ui#2145, reka-ui#2262, bits-ui#1985), 24-hour modes that refuse 13–23 or show 01–24
(reka-ui#2463, bits-ui#914), hours shifted by the viewer's UTC offset (zag#3187), Korean day
periods that cannot be typed (react-spectrum#5832), DST repeated hours, and hydration mismatches
from engine-specific spaces (react-spectrum#7169). The research note lists 33 entries.

Research: [time-field](../../../docs/research/time-field.md) ·
[date-field](../../../docs/research/date-field.md) (`date-segments`) ·
[calendar](../../../docs/research/calendar.md) (`date-values`)

Depends on: `add-date-field` (`date-segments`, the Date Field machine, connect, contract
invariants), `add-calendar` (`date-values`), and through them `add-foundations`,
`add-a11y-foundations`, `add-field`, `add-text-field`, `add-checkbox`, `add-number-input`,
`add-theme-system`.

## What Changes

- A public **Time Field** component: `Root` (a Field when not inside one), `Label`,
  `Description`, `ErrorMessage`, `Input`, `Segment`, and an automatic hidden native input
  (`time` for a `Time` value).
- Value `Time | CalendarDateTime | ZonedDateTime | null` (a date-time value keeps its date and
  zone; only the time is edited); `granularity` `hour | minute | second` (default `minute`);
  `hourCycle` 12 | 24 (`h12` | `h23`, default the locale's; the prop wins); `minValue`/`maxValue`
  as `Time`; `hideTimeZone`; `placeholderValue` (default 00:00).
- Hour typing per cycle, a day period that hour edits never change, Latin "a"/"p" in every
  locale plus IME composition for localised names, zoned hour stepping across DST.
- Contract and driver (`getTimeField`), model-based tests, theme stylesheet (family `field`),
  stories, docs page.

## Capabilities

### New Capabilities

- `time-field`: the Time Field component — value and time types, hour cycles and the day
  period, time zones and DST, form value, contract, theme.

### Modified Capabilities

None (`date-segments` is reused unchanged).

## Non-goals

- Minute/second `step` (react-spectrum#4410, reka-ui#1834 — open question), milliseconds
  (react-spectrum#6415), carry between segments (react-spectrum#6590), durations
  (react-spectrum#9366 discussion), a time picker popup or list.
- Framework adapters other than React; fx.

## Impact

- `packages/core/src/components/time-field/` (contract, messages, a thin props mapping onto the
  Date Field machine with `maxGranularity: "hour"`), `packages/react/src/time-field/`,
  `@rind-ui/testing` (`getTimeField`), `@rind-ui/theme/time-field.css`, stories, docs.
- No new dependency. Reado: not used.
</content>
</invoke>
