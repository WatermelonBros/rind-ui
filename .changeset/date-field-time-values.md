---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
---

Date Field: time values and time ranges (no separate Time Field).

- **Time values.** A `Time` value, or `maxGranularity="hour"`, shows no date segments; a date-time keeps its date. Hour cycles (the prop wins over the locale), the day period as its own segment that hour edits never change, zoned stepping across DST, and a 12-hour "0" left alone meaning 12.
- **Form value.** `type="time"` hidden input with `step` 3600 / 60 / 1 and native `min` / `max`; `minValue` / `maxValue` may be `Time`s.
- **Time ranges.** `Time` ends named "Start time" / "End time", `allowsOvernight`, two `type="time"` hidden inputs.
- **Contract and driver.** `setDayPeriod`, `fill("21:05")`, the day-period invariant; range `setDayPeriod(edge, period)` and pair invariants that read time ends.
