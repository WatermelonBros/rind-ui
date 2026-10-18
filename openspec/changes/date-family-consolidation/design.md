## Handoff (WIP draft, moved to rind-ui-ca)

Status: spec draft in progress, not reviewed, not implemented. The branch is based on #113's
head (`add-date-field`) because it modifies the `date-field` and `date-segments` specs #113
archives; merge `origin/main` once #113 lands.

### Written so far

- `specs/calendar/spec.md`:
  - **Modified:** Anatomy, Value And Selection, Data Attributes, Contract, Calendar
    Invariants, Theme.
  - **Added:** Range Selection, Range Preview, Range Cancel And Leave, Drag Selection, Range
    Length, Unavailable Dates In Ranges, Range Prompts And Announcements, Reusable Range
    Helpers, Range Invariants, Month And Year Views.
  - Carried from add-range-calendar and the month picker / year picker, with the coordinator's
    names (`data-range-start` / `data-range-end`, `data-in-range`, `data-preview`) and the new
    `minRangeLength` / `maxRangeLength`.
- `specs/period-navigation/spec.md`: carried as is from add-month-year-picker (consumers renamed
  to the Calendar's month and year views).
- `specs/date-segments/spec.md`: Typing And Auto-Advance gains the 12-hour "0 alone means 12"
  rule (from add-time-field).

### Still to write

- `specs/date-field/spec.md`:
  - Time values (from add-time-field).
  - Range mode (from add-date-range-field + paired-fields and add-time-range-field, with
    `allowsOvernight`).
  - Popover parts Trigger / Positioner / Content / Calendar in single and range mode (from
    add-date-picker's picker-popover and add-date-range-picker).
- proposal.md and tasks.md.
- `git rm` the seven retired changes: add-date-picker, add-range-calendar, add-date-range-field,
  add-date-range-picker, add-time-field, add-time-range-field, add-month-year-picker. Merge their
  inventory rows into Calendar and Date Field.
- A table, as in add-combobox-variants design §7, mapping every retired requirement and coverage
  class to where it went, or dropping it with a reason.

### Decisions taken (user, via the coordinator)

- Date Picker is not a component: Date Field gains optional Trigger + Positioner / Content
  (popover) parts hosting a Calendar. Segments and calendar share one value; Escape and focus
  return go to the trigger.
- Calendar and Date Field stay standalone. range-calendar becomes Calendar
  `selectionMode="range"`. Month and year pickers become Calendar `view="months" | "years"`.
- Time Field is Date Field with no date segments (`maxGranularity: "hour"`, already in the
  machine). There is no real divergence. The four additions carried over:
  1. the `Time` value type (a date-time keeps its date; `Time` min/max are compared on the
     value's day);
  2. hidden input `type="time"` with step 3600 / 60 / 1;
  3. a 12-hour "0" committed alone means 12 (a date-segments rule, written);
  4. the contract action `setDayPeriod`.
- Date Field range mode: start and end segment groups with a separator, one value
  `{ start, end }`, two hidden inputs (`name` pair, configurable), typing past the start's last
  segment moves to the end, invalid when end < start.
- In range mode the picker parts host a range Calendar sharing the value; committing the range
  closes the popover and returns focus to the trigger.
- **Order of delivery:**
  1. Calendar range mode, as its own implementation PR, with the range-band skin, examples and
     snapshots;
  2. Date Field range;
  3. the picker parts (single and range).

### Open questions

- `view` as a fixed prop, or controllable with drill-down (heading press: days → months →
  years)? The draft has a fixed prop; drill-down is not specified.
- Range mode prop on Date Field: `range` (boolean) or `selectionMode="range"`, to mirror
  Calendar?
- Keep `paired-fields` and `picker-popover` as capabilities of their own (shared behaviour), or
  fold them into `date-field` requirements as the coordinator's brief suggests? Folding was
  planned.
- Drag selection (carried from add-range-calendar) was not in the coordinator's list for the
  Calendar range PR. Keep it in phase 1 or move it to a later phase?
