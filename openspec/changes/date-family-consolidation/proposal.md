## Why

The date family was planned as nine components (Calendar, Range Calendar, Month / Year Picker, Date Field, Time Field, Date Range Field, Time Range Field, Date Picker, Date Range Picker), most of them the same machine with one option set. The user decided against duplicates: Calendar and Date Field stay the only two components, and every other one becomes a mode or a set of parts of them. One vocabulary (`selectionMode="range"`) across the family, one docs page each, one driver each.

## What Changes

- **Calendar** gains `selectionMode="range"` (from add-range-calendar: anchor, preview, cancel and leave, drag selection, `minRangeLength` / `maxRangeLength`, unavailable dates in ranges, prompts and announcements, reusable range helpers, range invariants) and month and year views. `view` is controllable (`view` / `defaultView` / `onViewChange`, `minView` / `maxView`) with drill-down from the heading (from add-month-year-picker; `period-navigation` is carried as is).
- **Date Field** gains time values, which make it the time field when it shows no date segments (from add-time-field: `Time` values, hour cycles, day period, zones and DST, `type="time"` form value, `setDayPeriod`). It also gains `selectionMode="range"` (from add-date-range-field with `paired-fields`, and add-time-range-field with `allowsOvernight`), and optional picker parts `control`, `trigger`, `clear-trigger`, `positioner`, `content` and `calendar` hosting a Calendar that shares the value (from add-date-picker with `picker-popover`, and add-date-range-picker).
- `date-segments`: a 12-hour "0" committed alone means 12.
- The seven retired changes are deleted (`git rm`); their inventory rows merge into Calendar and Date Field; design.md maps every retired requirement to its new home.

## Capabilities

### New Capabilities

- `period-navigation`: paging a period grid (carried from add-month-year-picker).

### Modified Capabilities

- `calendar`: range mode, month and year views, view drill-down.
- `date-field`: time values, range mode, picker parts; one contract with range and picker variants; one stylesheet.
- `date-segments`: the 12-hour "0" rule.

## Impact

Calendar and Date Field gain props, parts and contract variants; no new component, no new runtime dependency. Delivery is in phases (tasks.md): 1. Calendar range; 1b. drag selection; 2. Calendar views and drill-down; 3. Date Field time values and range; 4. picker parts. Each phase is its own implementation PR with its examples, snapshots and docs.
