## Context

[time-field.md](../../../docs/research/time-field.md) has the comparison and the bug history.
Time Field is React Aria's design — the date-field state with the largest segment fixed to the
hour — on rind-ui's `date-segments`. It builds on, and does not re-specify:

| Change | What Time Field uses |
|---|---|
| `add-date-field` | `date-segments` (segments, typing, day period and composition, stepping, commit points, validity, paste, RTL, SSR), the Date Field machine and connect (parameterised by scope and `maxGranularity`), `dateSegmentInvariants`, Field and form integration |
| `add-calendar` | `date-values` (`Time`, zoned values, formatting, the clock) |
| everything Date Field depends on | through Date Field |

## Goals / Non-Goals

**Goals:**
- No second machine: Time Field is a props mapping, its own scope, parts, contract and theme.

**Non-Goals:**
- `step`, milliseconds, durations (proposal Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/components/time-field/
├─ time-field.props.ts       TimeFieldProps → DateFieldMachineProps: maxGranularity "hour", value conversion
│                            (Time ↔ CalendarDateTime on a fixed reference day), min/max on the value's day
├─ time-field.contract.ts    Date Field contract with scope time-field + setDayPeriod + time invariants
└─ time-field.messages.ts    Date Field messages with time defaults (valueDescription "Selected time: {formatted}")
packages/react/src/time-field/   Root, Label, Description, ErrorMessage, Input, Segment (Date Field parts with scope time-field)
packages/theme/src/time-field.css
```

### 2. Machine (reused)

The Date Field machine runs with `maxGranularity: "hour"`; its states (`idle`, `editing`,
`composing`), events and effects are unchanged (add-date-field design §3). Two inputs differ:

- **Value conversion at the boundary**: a `Time` value is held as a `CalendarDateTime` on a fixed
  reference day (2000-01-01, never "today", so nothing depends on the clock and DST never
  applies to plain times) and converted back to `Time` on emission; a date-time value is held as
  is and only its time segments are shown. *Alternative*: React Aria converts onto
  `today(getLocalTimeZone())` — a clock dependency and a DST exposure for plain times.
- **Placeholder value**: 00:00 by default; for zoned values, the zone of the value or default
  value.

Hour cycles and the day period are `date-segments`' (`h12`/`h23` only; the day period a separate
draft field converted only in `toValue`), so every PM→AM bug class in the research note is a
`date-segments` scenario plus the Time Field scenarios here.

### 3. Connect

Date Field's connect with scope `time-field`; the hidden input uses `type="time"` for `Time`
values with `step` from the granularity and `min`/`max` from the `Time` bounds (ISO
`toString()`).

### 4. Contract and model-based tests

- Configurations: `en-US` 12-hour minute; `de-DE` 24-hour second; `ja-JP` 12-hour (午前/午後
  before the hour); `ko-KR` with composition; `es-ES` 12-hour ("p. m."); `ar-EG` arab digits;
  `hourCycle={24}` in `en-US`; zoned `America/New_York` on 2026-11-01 and 2026-03-08; `hideTimeZone`
  in `zh-TW`; min/max; required; read-only.
- `setDayPeriod` and `fill(time)` per the spec; the time invariants added to
  `dateSegmentInvariants`.

### 5. Theme

`time-field.css` declares the selectors for scope `time-field` reading `--rind-time-field-*`
with fallbacks to the same semantic tokens `date-field.css` uses (not to `--rind-date-field-*`,
so overriding one field does not change the other).

## Risks / Trade-offs

- [A component with no machine of its own] → it still ships every layer (connect via Date
  Field's parameterised connect, its own contract, driver, theme, stories, docs); a separate
  machine would duplicate `date-segments`.
- [Reference day 2000-01-01 for plain times] → plain `Time` values have no zone, so no DST; zoned
  times use their own date.

## Open Questions

- `step` for minutes/seconds (snapping on commit and arrow increments): add as a `date-segments`
  option when the first consumer asks; the hidden input's `step` already exists.
</content>
</invoke>
