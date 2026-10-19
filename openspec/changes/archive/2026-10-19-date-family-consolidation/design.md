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

### Open questions — settled (user, via the coordinator, 2026-10-18)

1. `view` is controllable (`view` / `defaultView` / `onViewChange`, bounded by `minView` /
   `maxView`) with drill-down from the heading (calendar: View Drill-Down); implemented after the
   range PR.
2. The range prop is `selectionMode="range"` across the family (Calendar and Date Field).
3. `paired-fields` and `picker-popover` fold into `date-field` requirements ("Range Mode — …",
   "Picker — …"): Date Field is their only consumer; extract again when a second one appears.
4. Drag selection stays in the spec (calendar: Drag Selection); its implementation is a follow-up
   PR (phase 1b) after the Calendar range PR.

### Retirement table

Every requirement of the seven retired changes and where it went. Nothing is dropped: each
coverage class moves with its requirement (model classes per mode in tasks.md).
Scenarios move with their requirement too: the month and year pickers' scenarios are kept as
period scenarios of calendar "Month And Year Views" (suffixed "(months view)" / "(years view)").

| Retired change | Capability | Requirement | Where it went |
|---|---|---|---|
| add-time-field | time-field | Date Field Parity | date-field: Time Values (a Date Field with no date segments) |
| add-time-field | time-field | Value And Time Types | date-field: Time Values |
| add-time-field | time-field | Hour Cycles | date-field: Time Values — Hour Cycles |
| add-time-field | time-field | Day Period | date-field: Time Values — Day Period |
| add-time-field | time-field | Time Zones And Daylight Saving | date-field: Time Values — Time Zones And Daylight Saving |
| add-time-field | time-field | Form Value | date-field: Time Values — Form Value |
| add-time-field | time-field | Contract | date-field: Contract (`setDayPeriod`, time `fill`, day-period invariant) |
| add-time-field | time-field | Theme | date-field: Theme (one sheet; a time field looks the same) |
| add-date-range-field | date-range-field | Anatomy | date-field: Range Mode; Anatomy |
| add-date-range-field | date-range-field | Value And Callbacks | date-field: Range Mode |
| add-date-range-field | date-range-field | Field Integration | date-field: Range Mode — Field Integration |
| add-date-range-field | date-range-field | Disabled And Read-Only | date-field: Range Mode — Disabled And Read-Only |
| add-date-range-field | date-range-field | Messages | date-field: Range Mode — Messages |
| add-date-range-field | date-range-field | Data Attributes | date-field: Data Attributes (`data-edge`, `data-range`, `data-invalid-edge`) |
| add-date-range-field | date-range-field | Contract | date-field: Contract (range variant) |
| add-date-range-field | date-range-field | Theme | date-field: Theme |
| add-date-range-field | paired-fields | One Control, Two Embedded Fields | date-field: Range Mode — One Control Two Embedded Fields |
| add-date-range-field | paired-fields | Derived Value | date-field: Range Mode — Derived Value |
| add-date-range-field | paired-fields | Ends Never Edit Each Other | date-field: Range Mode — Ends Never Edit Each Other |
| add-date-range-field | paired-fields | Range Validity | date-field: Range Mode — Range Validity |
| add-date-range-field | paired-fields | Focus Between Ends | date-field: Range Mode — Focus Between Ends |
| add-date-range-field | paired-fields | Names And Description | date-field: Range Mode — Names And Description |
| add-date-range-field | paired-fields | Hidden Inputs And Form | date-field: Range Mode — Hidden Inputs And Form |
| add-date-range-field | paired-fields | Controlled Value, Clear And Reset | date-field: Range Mode — Controlled Value Clear And Reset |
| add-date-range-field | paired-fields | Granularity And Locale Changes | date-field: Range Mode — Granularity And Locale Changes |
| add-date-range-field | paired-fields | Pair Invariants | date-field: Range Mode — Pair Invariants |
| add-time-range-field | time-range-field | Composition Parity | date-field: Range Mode (time ends) |
| add-time-range-field | time-range-field | Value And Time Types | date-field: Range Mode (`TimeRangeValue`), Time Values |
| add-time-range-field | time-range-field | Ordering And Overnight | date-field: Range Mode — Time Ends And Overnight |
| add-time-range-field | time-range-field | Day Period Per End | date-field: Range Mode — Day Period Per End |
| add-time-range-field | time-range-field | Form Values | date-field: Range Mode — Time Form Values |
| add-time-range-field | time-range-field | Contract | date-field: Contract (range variant, `setDayPeriod(edge, …)`) |
| add-time-range-field | time-range-field | Theme | date-field: Theme |
| add-date-picker | date-picker | Anatomy | date-field: Picker Parts; Anatomy |
| add-date-picker | date-picker | Value And Callbacks | date-field: Picker Parts (one props type) |
| add-date-picker | date-picker | Calendar Binding | date-field: Picker — Calendar Binding |
| add-date-picker | date-picker | Contract | date-field: Contract (picker variant) |
| add-date-picker | date-picker | Theme | date-field: Theme (picker parts) |
| add-date-picker | picker-popover | One Value Owner | date-field: Picker — One Value Owner |
| add-date-picker | picker-popover | Open State And Reasons | date-field: Picker — Open State And Reasons |
| add-date-picker | picker-popover | Opening | date-field: Picker — Opening |
| add-date-picker | picker-popover | Modality | date-field: Picker — Modality |
| add-date-picker | picker-popover | Initial Focus And Restore | date-field: Picker — Initial Focus And Restore |
| add-date-picker | picker-popover | Dismissal And Nesting | date-field: Picker — Dismissal And Nesting |
| add-date-picker | picker-popover | Select And Close | date-field: Picker — Select And Close |
| add-date-picker | picker-popover | Typing While Open | date-field: Picker — Typing While Open |
| add-date-picker | picker-popover | Names And Description | date-field: Picker — Names And Description |
| add-date-picker | picker-popover | Clear | date-field: Picker — Clear |
| add-date-picker | picker-popover | Field And Form Participation | date-field: Picker — Field And Form Participation |
| add-date-picker | picker-popover | State Kept Until Exit | date-field: Picker — State Kept Until Exit |
| add-date-picker | picker-popover | Touch | date-field: Picker — Touch |
| add-date-picker | picker-popover | Data Attributes | date-field: Picker — Data Attributes |
| add-date-picker | picker-popover | Picker Invariants | date-field: Picker — Picker Invariants |
| add-date-range-picker | date-range-picker | Composition | date-field: Picker Parts (range mode) |
| add-date-range-picker | date-range-picker | Value And Callbacks | date-field: Range Mode, Picker Parts |
| add-date-range-picker | date-range-picker | Committing A Range | date-field: Picker — Range: Committing A Range |
| add-date-range-picker | date-range-picker | Cancel And Leave | date-field: Picker — Range: Cancel And Leave |
| add-date-range-picker | date-range-picker | Resume | date-field: Picker — Range: Resume |
| add-date-range-picker | date-range-picker | Typing And Clearing | date-field: Picker — Range: Typing And Clearing |
| add-date-range-picker | date-range-picker | Names, Announcements And Form | date-field: Picker — Range: Names Announcements And Form |
| add-date-range-picker | date-range-picker | Range Validity | date-field: Picker — Range: Range Validity |
| add-date-range-picker | date-range-picker | Contract | date-field: Contract (picker variant, range actions) |
| add-date-range-picker | date-range-picker | Theme | date-field: Theme |
| add-range-calendar | range-calendar | Calendar Parity | calendar: Range Selection (range mode of the one Calendar) |
| add-range-calendar | range-calendar | Value And Anchor | calendar: Value And Selection (MODIFIED), Range Selection |
| add-range-calendar | range-calendar | Preview | calendar: Range Preview |
| add-range-calendar | range-calendar | Cancel And Leave | calendar: Range Cancel And Leave |
| add-range-calendar | range-calendar | Drag Selection | calendar: Drag Selection (implementation: phase 1b) |
| add-range-calendar | range-calendar | Unavailable Dates In Ranges | calendar: Unavailable Dates In Ranges |
| add-range-calendar | range-calendar | Range ARIA, Prompts And Announcements | calendar: Range Prompts And Announcements |
| add-range-calendar | range-calendar | Reusable Range Helpers | calendar: Reusable Range Helpers |
| add-range-calendar | range-calendar | Range Data Attributes | calendar: Data Attributes (MODIFIED) |
| add-range-calendar | range-calendar | Contract | calendar: Contract (MODIFIED) |
| add-range-calendar | range-calendar | Range Invariants | calendar: Range Invariants |
| add-range-calendar | range-calendar | Theme | calendar: Theme (MODIFIED) |
| add-month-year-picker | month-picker | Anatomy | calendar: Anatomy (MODIFIED) |
| add-month-year-picker | month-picker | Value And Selection | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Focused Period And Page | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Keyboard Interaction | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Pointer And Touch | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Constraints, Unavailable And Disabled Months | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Disabled And Read-Only | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Range Selection | calendar: Month And Year Views ("range mode works in both views") |
| add-month-year-picker | month-picker | Grid Semantics | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Cell Names And States | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Triggers | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Announcements | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Messages | calendar: Month And Year Views (the days view's rule at the period) |
| add-month-year-picker | month-picker | Data Attributes | calendar: Data Attributes (MODIFIED) |
| add-month-year-picker | month-picker | Contract | calendar: Contract (MODIFIED) |
| add-month-year-picker | month-picker | Period Invariants | calendar: Calendar Invariants (MODIFIED) |
| add-month-year-picker | month-picker | Theme | calendar: Theme (MODIFIED) |
| add-month-year-picker | year-picker | Month Picker Parity | calendar: Month And Year Views (`view="years"`) |
| add-month-year-picker | year-picker | Pages Of Years | calendar: Month And Year Views (`yearsPerPage`), period-navigation |
| add-month-year-picker | year-picker | Year Names And Eras | calendar: Month And Year Views (cell names with eras) |
| add-month-year-picker | year-picker | Theme | calendar: Theme (MODIFIED) |
| add-month-year-picker | period-navigation | Pages And Grid Shape | period-navigation (carried as is; consumers renamed) |
| add-month-year-picker | period-navigation | Moves | period-navigation (carried as is; consumers renamed) |
| add-month-year-picker | period-navigation | Constraints On Moves | period-navigation (carried as is; consumers renamed) |
| add-month-year-picker | period-navigation | Initial Focused Period | period-navigation (carried as is; consumers renamed) |
