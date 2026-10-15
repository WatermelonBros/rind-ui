## Context

[time-range-field.md](../../../docs/research/time-range-field.md) holds the comparison. Time Range Field is
`paired-fields` over two embedded Time Fields; it adds no machine states. It builds on, and does not
re-specify:

| Change | What it uses |
|---|---|
| `add-date-range-field` | `paired-fields` (coordinator, derived value, ends never edit each other, focus between ends, names, hidden inputs, controlled value, invariants) |
| `add-time-field` | Time Field behaviour per end: hour cycles, day period, zones and DST, `Time` values on a fixed reference day, hidden `type="time"` input |
| `add-date-field`, `add-calendar` | through them: `date-segments`, `date-values` |

## Goals / Non-Goals

**Goals:** no new machine; ordering is one pure function; overnight is explicit.

**Non-Goals:** popup, step, durations (proposal).

## Decisions

### 1. Layout

```
packages/core/src/components/time-range-field/
├─ time-range-field.props.ts     props → paired-fields options: end machine = Time Field (maxGranularity "hour"),
│                                 compareEnds = timeOrder(allowsOvernight)
├─ time-range-field.contract.ts  paired contract + setDayPeriod(edge) + time invariants
└─ time-range-field.messages.ts  paired messages with time defaults (startTime/endTime names, "Selected range: … to …",
                                 "ends the next day", endBeforeStart "End time must be after the start time")
packages/react/src/time-range-field/   same parts as Date Range Field, scope time-range-field
packages/theme/src/time-range-field.css
```

### 2. Ordering

`compareEnds(start, end)` is injected into `paired-fields`: for `Time` ends `start.compare(end) <= 0`, or any order
when `allowsOvernight`; for date-time and zoned ends `start.compare(end) <= 0` (instants for zoned values), and
`allowsOvernight` has no effect. Overnight detection for the description: plain `Time` with `end < start`.

### 3. Hidden inputs

Two `type="time"` inputs with `step` 3600/60/1, native `min`/`max` from the `Time` bounds; date-time ends use Date
Field's mapping.

### 4. Contract and model-based tests

Date Range Field's contract with scope `time-range-field`; `fill({ start, end })` takes times typed in the locale's order
(with "a"/"p"); `setDayPeriod(edge, "am" | "pm")`. Configurations: `en-US` 12-hour minute; `de-DE` 24-hour second; `ja-JP`
(day period before the hour); `es-ES` ("p. m."); `ko-KR` composition; strict and `allowsOvernight`; zoned ends in
`America/New_York` across 2026-11-01; min/max; required; read-only.

### 5. Theme

`time-range-field.css` selects scope `time-range-field` reading `--rind-time-range-field-*` with fallbacks to the semantic
tokens Date Range Field uses (not to its own tokens, so overriding one does not change the other).

## Requests to other changes

- **add-theme-system** (`theme-variants`) — APPLIED (coordinator, 2026-10-15): list Time Range Field in family `field` (also requested by
  add-date-range-field).
- Everything else is covered by add-date-range-field's requests to add-date-field and add-checkbox.

## Risks / Trade-offs

- [A component with no machine of its own] → it ships every layer (props mapping, contract, driver, theme, stories,
  docs); a separate machine would duplicate `paired-fields`.
- [Strict default rejects overnight ranges] → one prop; the message says what to do.

## Open Questions

- Minute `step` (inherited from Time Field).
