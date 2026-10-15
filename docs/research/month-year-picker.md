# Month / Year Picker — research

Status: done · Wave: 3 (Month/MonthRange/Year/YearRange Picker in Reka UI; a `month`/`year` view of the Date Picker in Ark/Zag; month and year selects in the Calendar header of Bits UI and in React Aria's docs)

Read [calendar.md](calendar.md) and [range-calendar.md](range-calendar.md) first: the date
foundation (`date-values`), the focus model (focus on the gridcell), the announcement rule,
the anchor/commit/cancel semantics of a range and its bug history are theirs and are reused,
not repeated. This note answers what is new when the cell is a **month or a year** instead of a
day: the grid shape, paging, navigation, the value a click emits, constraints at month/year
granularity, calendar systems with 13 months or eras, and whether this is a Calendar view or a
component of its own.

Cross-cutting: [accessibility.md](accessibility.md) §4.2 (roving tabindex), §6 (logical keys,
RTL), §7 (Announcer), §9 (dates); [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
§1.4 "Date fields / calendar", causes C (virtual focus never selects), D/E (announcer),
I (grid label on iOS VO), K (forced colours); [native-platform.md](native-platform.md) §8 (no
native month grid; `<input type=month>` has no usable picker across browsers and no year-only
equivalent). Reado does not use it.

## Pattern

- WAI-ARIA APG: no month/year pattern. The grid is the [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
  pattern, as for the Calendar's day grid ([Date Picker Dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
  has no month or year view; fetched 2026-10-14).
- Roles and attributes: `table[role=grid]` named by its heading (the year, or the range of
  years); `gridcell`s with roving `tabindex`; `aria-selected` true/false; `aria-disabled` for
  disabled and unavailable; `aria-current` for the current month/year; named prev/next buttons.
- Keyboard (APG grid, adapted): arrows move by one period horizontally and by a row
  vertically; Home/End first/last of the grid; PageUp/PageDown previous/next page (a year of
  months, a block of years); Enter/Space select.
- WCAG: 1.3.1, 1.4.1 (selected / current / unavailable never by colour alone), 2.1.1,
  2.4.3, 2.5.7 (range: click-click alternative), 2.5.8 (cells ≥ 24×24), 4.1.2, 4.1.3 (page
  change announced).

## How the others built it

### Reka UI (`MonthPicker`, `MonthRangePicker`, `YearPicker`, `YearRangePicker`; `useMonthPicker.ts`, `useYearPicker.ts`, `date/calendar.ts`)

- Four separate component families with the Calendar's anatomy: `Root`, `Header`, `Heading`,
  `Prev`, `Next`, `Grid`, `GridBody`, `GridRow`, `Cell`, `CellTrigger` (`MonthRangePicker` adds
  highlight attributes). Value `modelValue` (a `DateValue`, an array with `multiple`, or
  `{ start, end }` for the range variants), `placeholder` (the focused period), `minValue`/`maxValue`,
  `isMonthDisabled`/`isMonthUnavailable` (and year equivalents), `preventDeselect`,
  `initialFocus`, `nextPage`/`prevPage` overrides, `yearsPerPage` (default 12) for years.
- Grid: months in **4 columns** (`rows` chunked by 4, so 3 rows); years `createYearGrid` with
  `yearsPerPage` cells chunked by 4, starting at the decade start (`decadeAligned`) on first render
  and **not aligned after paging**. Paging by `Prev`/`Next` = one year (months) or `yearsPerPage` (years).
- Cell trigger: `div role="button"` inside the `td`, `aria-label` = "October 2026" (month) via
  `Intl`, roving `tabindex` (`data-focused`), `data-selected`, `data-today`, `data-unavailable`,
  `data-disabled`. Keyboard handled on the trigger with **hard-coded** `±4` for Up/Down, `±1`
  for Left/Right (mirrored in RTL), PageUp/PageDown = ±1 year; navigation is DOM-driven
  (`querySelector('[data-value=…]')`, page and retry on `nextTick`, recursion up to 48/…).
- The grid is `role="application"` (as the Calendar's), the root has a hidden `heading` with the
  label. Next/prev `aria-label` hard-coded "Next year".
- Value written: `MonthPickerRoot.resolveMonthValue` sets the **day of the previous value**
  (`value.copy().set({ day: reference.day })`), else the placeholder's day — after two bug
  reports below the picker emits the existing value with only the month (or year) changed.
- Problems: RK#2587 / RK#2588 (emitted the start of the month / year, discarding day and time),
  RK#2781 (custom grid dimensions: Up/Down hard-coded to 4 jumps diagonally).

### Ark UI / Zag (`date-picker`: `view`, `minView`, `maxView`)

- No separate component: the Date Picker has `view: "day" | "month" | "year"` (controllable,
  `defaultView`, `onViewChange`), `minView` (the finest view that selects; with `minView:
  "month"` it is a month picker) and `maxView`. A `ViewTrigger` (the heading button) switches to
  the next coarser view; clicking a cell in a coarser view focuses it and goes to the next
  finer view (`setFocusedValueForView` + `setPreviousView`) unless it is already `minView`,
  where it selects. Month and year tables are `Table` parts with `getMonthTableCellProps` /
  `getYearTableCellProps` and `columns` passed by the consumer (`getMonthsGrid({ columns,
  format })`, `getYearsGrid({ columns })`) — the arrow keys send `event.columns` (so Up/Down
  move by the consumer's column count).
- Keyboard in month/year views: arrows by ±1 and ±`columns`, PageUp/PageDown = previous/next
  year (month view) or decade (year view, `getDecadeRange`), Home/End first/last month of the year /
  year of the decade. Year view shows a **decade of 12** (`getDecadeRange`, one before and one
  after the decade, the outer two outside-visible).
- Range mode works in month and year views (`selectionMode: "range"` with the same `activeIndex`
  logic) — with bugs below. `translations.viewTrigger(view)` for the heading button.
- Problems: ZG#1906 (year view not paginated), ZG#2397 (arrow keys crashed in month/year views),
  ZG#2153 (min/max within two adjacent years: only one year selectable), ZG#2501 (Enter on a month
  containing an unavailable day did nothing, click worked), ZG#2556 (month-view range: crash and no
  `data-in-range`), ZG#3188 (view reset to day while closing), ZG#3257 (view-trigger labels
  described the current rather than the destination view), ZG#3336 (years outside the decade
  disabled when no min/max).

### React Aria / Bits UI (month and year *selects* in the header)

- React Aria has no month/year grid. Its docs show **dropdown Selects in the Calendar header**
  driven by `CalendarState.setFocusedDate` ("Month and year pickers" example); RA#4965 asked for a
  heading button that drills through months, years and year ranges and was answered with that example.
  Bits UI ships `Calendar.MonthSelect` / `Calendar.YearSelect` (native `<select>` elements writing the
  placeholder, `monthFormat`/`yearFormat`, optional `years` list) and the shadcn-svelte `captionLayout="dropdown"`.
- Problems: RA#9427 (choosing in a header Select moved focus into the grid, breaking type-ahead),
  BITS#1873 (a `minValue` in the next year left the year select without a selected item and
  `selectedYearItem` `undefined`), BITS#902 (focusable selects inside an `aria-hidden` header).

### Kobalte, Base UI, Radix, Headless UI, Ariakit

No month or year picker. Base UI tracks "Calendar and Date Fields primitives" (BU#1709, open);
Kobalte has no date picker (KB#305 request).

### Findings that shape the decision

1. Libraries split in two: **drill-down views inside the Calendar** (Ark) and **stand-alone
   grids** (Reka). Stand-alone grids also serve the commonest real uses — a billing month, a
   birth year, a report period, a fiscal-year range — that never show a day. Views need the
   Calendar's heading to become a button, which is a Calendar API decision (not ours).
2. The state both share is a **focused period + a page start**, i.e. exactly `calendar-navigation`'s
   shape one level up; the moves differ (rows, pages of years), so a second pure module is the right size.
3. Every library hard-codes the grid shape (4 columns); two bugs follow (RK#2781, ZG's
   `columns` plumbing). Columns must be one value feeding rendering and navigation.
4. "What value does a click emit" was reported twice (RK#2587/#2588). The Calendar's rule
   (`date-values`: keep type, calendar and time) already answers it.
5. Unit-granular constraints are subtle (ZG#2153, ZG#3336, ZG#2501, BITS#1873): min/max compare at
   the unit; "outside the page" is not "disabled"; an unavailable unit is decided by the consumer for
   the unit, never derived from days; the focused unit must always exist in the grid.

## Accessibility

- **Grid semantics** as the Calendar: `role=grid` on a `table`, `tr`/`td[role=gridcell]`, focus on the
  gridcell itself (no inner button, no `role=application`; RA#4637, RK#2228, RK#2438 in calendar.md).
  Reka's month/year pickers repeat the inner-button + `application` model.
- **Names**: a month cell is named "October 2026" (long month + year, era when the calendar shows
  eras), a year cell "2026" (with era / cyclic name where the locale formats it), states as attributes
  not words. The grid is named by its heading: the year ("2026") or the year range ("2016 – 2027").
- **Current period**: `aria-current="date"` on the cell of the current month / year (the nearest
  ARIA 1.2 token, as the Calendar; device check shared with calendar.md open questions).
- **Selection**: `aria-selected` true/false on every selectable cell (collections invariant 9);
  range preview is not selection (range-calendar.md); disabled cells are not focusable, unavailable
  ones are focusable and `aria-disabled` (calendar.md: ZG#2474, RA#6108).
- **Announcing the page**: the Announcer speaks the heading when the page changes while focus is not in
  the grid (trigger press, controlled focus); with focus in the grid the focused cell's name carries the
  year, so no second announcement (calendar.md rule). RA#9427 shows the opposite failure: a controlled
  change must **not** move DOM focus when the grid does not have it.
- **iOS VO / touch**: the heading is a real heading placed before the grid (calendar.md, cause I). No
  hidden duplicate.
- **Keyboard**: no new interaction concept; arrows mirrored in RTL horizontally, never vertically; the
  grid's row keys need the `"grid"` orientation requested by add-calendar.
- **Target size**: 24×24 minimum (theme default larger: 3–4 cells per row are wide); 4 columns × 3 rows of
  month names must still fit 320 px.
- **Forced colours / reduced motion**: as calendar.md (selected `Highlight`, current a border,
  unavailable strike-through, disabled `GrayText`, range middle `Highlight` + preview dashed).
- **Native primitive**: none. `<input type="month">` has no picker in Firefox/Safari desktop and no
  year-only counterpart (native-platform §8).

## Bug history

Searched (2026-10-14) unovue/reka-ui (month picker, year picker, MonthPicker, YearPicker, month range,
year range), chakra-ui/zag and chakra-ui/ark (month view, year view, minView, decade, date picker month /
year), adobe/react-spectrum (month year dropdown, year picker, calendar month select), huntabyte/bits-ui
(month picker, year picker, calendar month/year select), kobaltedev/kobalte, mui/base-ui. About 120 hits,
18 read in full; GitHub search was rate limited partway, so the Bits and Ark lists are shorter than
for the Calendar (date-picker bugs of Zag/Ark that are not about months and years are in
[calendar.md](calendar.md) and [range-calendar.md](range-calendar.md)).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RK | [#2587](https://github.com/unovue/reka-ui/issues/2587) | MonthPicker with a bound `CalendarDateTime` resets the day and time to the start of the month | the picker emitted `startOfMonth` | closed: keeps the previous value's day | emit the current value with only the month changed (`toEmitted`, clamp the day); scenario |
| RK | [#2588](https://github.com/unovue/reka-ui/issues/2588) | YearPicker resets month, day and time to January 1st | same | closed | same for years (29 Feb → 28 Feb) |
| RK | [#2781](https://github.com/unovue/reka-ui/issues/2781) | custom 3×4 grid: Up/Down jumps diagonally | Up/Down hard-coded to ±4 | open | one `columns` value for rendering and navigation; row moves are (row, column) moves; scenario |
| ZG | [#3336](https://github.com/chakra-ui/zag/issues/3336) | all years outside the current decade disabled when no min/max | "outside the visible page" folded into disabled with `||` | closed (fix in `ac82db13c`) | cells on a page are never disabled by the page; paging reaches them (calendar.md RA#4614 lesson) |
| ZG | [#2153](https://github.com/chakra-ui/zag/issues/2153) | min and max within one year spanning two calendar years: only the later year selectable | min/max compared as dates against the year's first day | closed | compare constraints at the unit: a year / month is selectable if any of it lies inside; scenario |
| ZG | [#2501](https://github.com/chakra-ui/zag/issues/2501) | Enter on a month does nothing when it contains unavailable days (click works) | not stated by the maintainer (fix pushed); the key path and the click path evidently decided selectability differently | closed | one `selectable(period)` guard for press and key; the consumer decides unit availability (`isMonthUnavailable`), never derived from days; scenario |
| ZG | [#2397](https://github.com/chakra-ui/zag/issues/2397) | arrow keys crash in month/year view (`n.map is not a function`) | not stated (fix pushed); the error shows month/year handlers received a value shape they could not map | closed | keyboard on every unit and mode in the model-based test; scenario |
| ZG | [#1906](https://github.com/chakra-ui/zag/issues/1906) | year view not paginated | regression in the decade table | closed | paging is a spec requirement with scenarios for both units |
| ZG | [#2556](https://github.com/chakra-ui/zag/issues/2556) | range in month view: `date.toDate is not a function`, middle months lack `data-in-range` | month/year cell values (numbers) were used as dates by the range logic (the machine has a normalisation step for them) | closed | the range attributes are computed by comparing period starts, in both units; scenario |
| ZG | [#3257](https://github.com/chakra-ui/zag/issues/3257) | view-trigger label names the current view | label built from the wrong view | closed: label describes the destination and the trigger disables itself at the last view | prev/next names say what they page ("Previous year" / "Previous years"), from `messages` |
| ZG | [#3188](https://github.com/chakra-ui/zag/issues/3188) | closing the popover flashes the day view | not stated; the view is reset to day while the popover closes | closed | a picker has no hidden reset on blur; composed views keep their own state (design: Calendar integration) |
| RK | [#1412](https://github.com/unovue/reka-ui/issues/1412) | request for Month Picker and Month Range Picker | none shipped | closed: answered with a decade view recipe, later shipped | confirms stand-alone range variants are wanted |
| RK | [#2389](https://github.com/unovue/reka-ui/issues/2389) | request: `view: 'day' \| 'month' \| 'year'` on Calendar | — | closed as duplicate of #1933 (MonthPicker/YearPicker components) | maintainers chose components over a Calendar view |
| RA | [#4965](https://github.com/adobe/react-spectrum/issues/4965) | press the heading to pick a month, then year, then year range | feature request | closed: answered with a header Select example on `CalendarState` | drill-down is a composition over a controlled `focusedValue`; we support it without a Calendar API |
| RA | [#9427](https://github.com/adobe/react-spectrum/issues/9427) | picking in a header month/year Select moves focus into the grid, breaking type-ahead | `setFocusedDate` also set "focused" | closed (fix direction: only focus the grid when it already has focus) | a controlled `focusedValue` change never steals DOM focus; scenario |
| BITS | [#1873](https://github.com/huntabyte/bits-ui/issues/1873) | `minValue` next year: the year select has no selected item (`undefined`) | the focused year (this year) is outside the allowed years | closed | the initial focused period is clamped into min/max, so it always exists in the grid; scenario |
| BITS | [#902](https://github.com/huntabyte/bits-ui/issues/902) | focusable month/year selects under an `aria-hidden` header | header hidden to avoid double reading | closed | the Header part is never `aria-hidden` (already in calendar spec) |
| ZG | [#3084](https://github.com/chakra-ui/zag/issues/3084) | hovering an outside day switches the month in range mode | hover moved the focused date | closed | hover never pages (range-calendar.md; reused) |

Range semantics (anchor, commit on a second press, cancel on leave, preview ≠ selected, paging keeps
the anchor) have their own 32-entry table in [range-calendar.md](range-calendar.md); they apply here
unchanged and are not repeated.

## Known pitfalls

- **Hard-coded grid shape** (RK#2781, Zag's `columns` event field): one `columns` feeds both the
  rows rendered and the vertical moves.
- **Emitted value** (RK#2587/#2588): never rebuild the date from the period; change the unit on the
  current value and clamp.
- **Unit-level constraints** (ZG#2153, ZG#3336, ZG#2501, BITS#1873): compare at the unit; page
  membership is not disabledness; the focused cell must exist.
- **Calendar systems**: 13-month calendars (hebrew leap years, ethiopic, coptic) make the month grid's
  last row short and the column of the "same month next year" ambiguous; eras (japanese, gregorian
  BC) restart the year number; both break "12 months, years are integers".
- **Keyboard on every mode** (ZG#2397): month, year, single, range.
- **Focus theft** from controlled changes (RA#9427).
- **Engine**: month/year names of non-gregorian calendars come from `Intl` with the calendar option;
  the cyclic-year `relatedYear` part (calendar.md RA#8017) is mapped as there.

## Testing notes

- Node: the pure `period-navigation` module for both units, all keys in LTR/RTL, page edges, `columns`
  3/4/6, min/max clamps, hebrew leap year (13 months), ethiopic (13 months, last month 5–6 days),
  japanese era boundary (Heisei 31 / Reiwa 1), gregorian BC/AD boundary, `yearsPerPage` 10/12/20,
  initial focus clamped (BITS#1873), unit-level min/max (ZG#2153).
- Machine (Node): single and range paths reusing Range Calendar's oracle for the anchor; page
  changes announce only while the grid is not focused; controlled `focusedValue` does not focus
  (RA#9427).
- Browser: focus moves to the cell for keyboard paging, never for pointer paging with the grid
  unfocused; `virtual` focus never selects; touch tap = press.
- Contract: `select(period)` by accessible name ("October 2026", "2026"), keyboard path computed by the
  navigation module; queries read ISO from `data-value` (period start).
- AT matrix (manual, shared with the Calendar): NVDA + Chrome / Firefox focus mode on the cell, VO macOS,
  VO iOS (heading first), TalkBack.

## Decisions

- **Separate components, one change.** `MonthPicker` and `YearPicker` (scopes `month-picker` and
  `year-picker`) are components of their own, not Calendar views: they are useful alone (the Reka
  maintainers made the same call, RK#2389 → #1933); their anatomy and navigation differ from the day
  grid; and a Calendar `view` would force changes into `add-calendar` that we may not make. The same
  machine and connect serve both through a `unit: "month" | "year"` parameter (like Time Field over Date
  Field); `selectionMode: "single" | "range"` covers the four Reka families. Multiple selection is not
  offered (no consumer; Reka's `multiple` is unused in the issues).
- **Drill-down in a Calendar** is a documented composition over what exists: the Calendar's controllable
  `focusedValue` and a conditionally rendered `MonthPicker` / `YearPicker` whose `value`/`focusedValue`
  are the Calendar's focused date, switched by a button in the consumer's Heading. No Calendar change
  is required; a first-class `ViewTrigger` is a request (design).
- **Pure `period-navigation`** (sibling of `calendar-navigation`, shared by both units): moves
  `next`/`previous` (by one period, crossing pages), `next-row`/`previous-row` (by `columns`, same column
  in the adjacent row, crossing pages), `first`/`last` (of the page), `next-page`/`previous-page`; pages
  are a year of months (`monthsInYear` of the display calendar, 13 for some) or `yearsPerPage` years
  (default 12, columns default 4, pages are fixed partitions of the year numbering so paging never
  drifts, never straddle an era). Constraints clamp as in `calendar-navigation`.
- **Keyboard**: Left/Right (mirrored in RTL), Up/Down (row), **Home/End = first/last period of the
  page** (a deliberate difference from the Calendar's week edges: a 12-cell page has no useful row
  edges and the mapping needs no new logical key), PageUp/PageDown = previous/next page (year of months /
  block of years), Enter/Space select. Arrows cross pages.
- **Value**: single `DateValue | null`, range `{ start, end } | null`; the value is **unit-granular**:
  comparisons, `aria-selected`, constraints and range order use the period; the emitted date is the
  current value with only its month (or year) changed and the day clamped to the new month (so 31 Mar →
  28 Feb), keeping type, calendar and time of day (`toEmitted`, answers RK#2587/#2588); with no value,
  day 1 of the period, a gregorian `CalendarDate` unless `placeholderValue`/`defaultValue` says
  otherwise. In a range, both ends are emitted as the first day of their period when there is no
  current value and keep their day otherwise; the end is the period, not its last day.
- **Constraints**: `minValue`/`maxValue` inclusive at the unit (a month is selectable when any of it is
  inside), `isMonthUnavailable(month)` / `isYearUnavailable(year)` consumer-decided; disabled (outside
  min/max, component disabled) ≠ unavailable; cells of the page never disabled for being on the page.
- **Focus on the gridcell**, no inner button, no `role="application"`, `aria-selected` true/false,
  `aria-current="date"` for the current period, roving tabindex, one focus ring.
- **Range**: Range Calendar's machine semantics (anchor, preview, commit on the second press, Escape,
  `commitOnBlur`, paging keeps the anchor, hover never pages, `allowsNonContiguousRanges`) reused through
  `range-calendar.range.ts` (`makeRange`, `availableBounds`, `crossesUnavailable`) applied to period starts;
  no drag selection in this change (click-click and Enter-Enter satisfy 2.5.7).
- **Parts**: `Root` (`div role=group`), `Header`, `Heading` (h2: the year, or the year range),
  `PrevTrigger`/`NextTrigger`, `Grid` (`table`), `Body`, `Row`, `Cell` (`td`), no header row (no
  weekday-like column header). Every part has `data-scope` `month-picker` / `year-picker`.
- **Machine**: states `idle` / `anchored` (range only), context `gridFocused`, `focusedValue`
  (controllable), `pageStart`, `anchor`, `hovered`; events as Calendar/Range Calendar with period dates.
- **`data-*`**: Calendar's (cells: `data-value` ISO period start, `data-selected`, `data-current`, `data-disabled`,
  `data-unavailable`, `data-focus`, `data-focus-visible`, `data-hover`, `data-pressed`) plus Range
  Calendar's range attributes. `data-current` replaces `data-today`.
- **Contract**: actions `select(period)`, `selectRange(start, end)`, `focusPeriod`, `nextPage()`,
  `previousPage()`, `press(key)`, `cancel()`; queries `value()`, `range()`, `focusedPeriod()`, `heading()`,
  `isSelected`, `isUnavailable`, `isDisabled`, `current()`, `announcements()`; traits `selectable`,
  `composite-roving`, plus period invariants.
- **Deliberately different**: standalone components instead of Calendar views (Ark) or header selects
  (RA, Bits); focus on the cell (Reka: inner button + application); value keeps day and time (Reka's start
  of month, later fixed); `columns` configurable and consistent; Home/End by page; unit-level constraints;
  no deselect on re-press; no multiple selection.

## Open questions

- A Calendar `ViewTrigger` part (Ark) or `view` prop: asked of add-calendar as a request; not needed for
  the composition recipe.
- Drag selection in range mode (Reka has none; Range Calendar's `dragging` state exists): add on request.
- Fiscal-year or quarter pickers: a `unit: "quarter"` would reuse everything; not requested.
