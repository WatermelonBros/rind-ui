## Context

[month-year-picker.md](../../../docs/research/month-year-picker.md) has the comparison and the bug
history. This change builds on, and does not re-specify:

| Change | What the pickers use |
|---|---|
| `add-calendar` | `date-values` (types and `toEmitted`, calendar systems and `createCalendar`, the date clock and the current period, formatting, constraints, ISO); the machine pieces in `calendar.pieces.ts` (focused-date controllable, `focusCell`/`prepareAnnouncer` effects, announcer action); the request there for the `"grid"` orientation of `keyboard-interactions` (`PREV_ROW`/`NEXT_ROW`) |
| `add-range-calendar` | `range-calendar.range.ts` (`makeRange`, `availableBounds`, `crossesUnavailable`), the anchor / commit / cancel / `commitOnBlur` semantics, prompt and announcement messages, range data attributes |
| `add-foundations` | `setup()`/`machine()`, `controllable()`, `$sync`, effects, contracts, drivers, `testMachine`; `selectable` and `composite-roving` traits |
| `add-a11y-foundations` | `keyboard-interactions`, `press-interactions` (press on release, touch cancel, hover from mouse/pen), `interaction-modality`, `announcer`, `i18n-messages`, `element-ids`, `hidden-content` (prompt node) |
| `add-button` | `button-like-element` for the triggers |
| `add-overlay-infrastructure` | `layer-stack` logical-inside query for the range leave rule |
| `add-theme-system` | stylesheet convention; families `panel` and `collection item` (request below) |

## Goals / Non-Goals

**Goals:**
- One pure `period-navigation` module and one machine/connect pair serving four combinations
  (month|year × single|range), all driven by the same model-based tests.
- A value rule that cannot lose the caller's day, time or zone.

**Non-Goals:** Calendar views, header selects, multiple selection, drag, other units
(proposal Non-goals).

## Decisions

### 1. Components, not a Calendar view

Reka's maintainers closed "month & year view modes for Calendar" in favour of picker components
(reka-ui#2389 → #1933); Ark folds them into the Date Picker as views. Components win here
because the picker is useful alone, its anatomy has no weekday header, week rows or
multi-month grids, its navigation differs, and a view needs a Calendar API we may not change. A
Calendar can still drill down: render a `MonthPicker`/`YearPicker` in place of its grids with
`value` and `focusedValue` bound to the Calendar's `focusedValue` (documented recipe; tested in
the stories). Two scopes (`month-picker`, `year-picker`) give each its own driver, theme file and
docs page; the code is shared through a `unit` parameter, as Time Field shares Date Field's.

### 2. Layout

```
packages/core/src/components/
├─ period-navigation/
│  └─ period-navigation.ts       pure: pageOf(period, unit, o), periods(page, unit, o) → rows,
│                                move(focused, m, unit, o) → { focused, pageStart }, canPage, initialFocus
├─ period-picker/
│  ├─ period-picker.machine.ts   machine factory: (unit) ⇒ machine; composes calendar.pieces + range logic
│  ├─ period-picker.connect.ts   connect factory: (unit) ⇒ connect
│  └─ period-picker.value.ts     pure: emit(value, period, unit) (toEmitted + clamp), samePeriod, compareAt(unit)
├─ month-picker/                 month-picker.contract.ts, month-picker.messages.ts
└─ year-picker/                  year-picker.contract.ts, year-picker.messages.ts
packages/react/src/month-picker/, year-picker/    parts (shared implementations, scoped)
packages/theme/src/month-picker.css, year-picker.css
```

`period-navigation` options: `{ unit, columns, yearsPerPage, minValue, maxValue, calendar, locale }`.

### 3. Navigation

A *period* is a `CalendarDate` at day 1 (month 1, day 1 for years) in the display calendar. The
grid is the ordered list of the page's periods chunked by `columns`; a move is index arithmetic on
(row, column) inside the page plus a page step at the edges (`add({ months })` / `add({ years })`
from `@internationalized/date`, so month counts per year and eras come from the calendar, never
from `12`). Row moves use (row, column), not `± columns`, which is what makes 13-month years and
custom `columns` correct (reka-ui#2781). Clamping, `canPage` and `initialFocus` mirror
`calendar-navigation`. Constraints compare through `compareAt(unit)` on the period's first and last
day.

### 4. Machine

```ts
type PeriodPickerEvent =
  | { type: "NAVIGATE"; move: PeriodMove; modality: "keyboard" }
  | { type: "CELL.FOCUS"; date: CalendarDate; modality: Modality }
  | { type: "CELL.PRESS"; date: CalendarDate; modality: Modality }
  | { type: "CELL.HOVER"; date: CalendarDate } | { type: "GRID.HOVER_END" }
  | { type: "SELECT_FOCUSED"; modality: "keyboard" }
  | { type: "PAGE"; direction: 1 | -1; modality: Modality }
  | { type: "GRID.FOCUS"; modality: Modality } | { type: "GRID.BLUR" }
  | { type: "CANCEL" } | { type: "LEAVE" }                       // range only

states:
  idle      ── CELL.PRESS [selectable, single] / setFocused, select
            ── SELECT_FOCUSED [selectable, !readOnly, single] / select
            ── CELL.PRESS | SELECT_FOCUSED [selectable, range] ──► anchored / setAnchor, announceAnchor
  anchored  ── CELL.PRESS | SELECT_FOCUSED [selectableEnd] ──► idle / commit, announceRange
            ── CELL.HOVER / setHovered · GRID.HOVER_END / clearHovered
            ── CANCEL ──► idle / clearAnchor (consumed)
            ── LEAVE ──► idle / applyCommitOnBlur
  global    NAVIGATE / move · CELL.FOCUS / setFocused (no selection: cause C)
            PAGE [canPage] / page, announcePage [!gridFocused]
            GRID.FOCUS / gridFocused = true · GRID.BLUR / gridFocused = false
            $sync:value / clearAnchor, followValue (page to the value's period unless same period)
            $sync:focusedValue / constrain, realign (no focus effect unless gridFocused)
            $props:minValue|maxValue|locale|columns|yearsPerPage|createCalendar / constrain, realign
values:     value: controllable("value", { fallback: null, equal: samePeriodOrRange(unit) })
            focusedValue: controllable("focusedValue", { fallback: initialFocus, equal: isSameDay })
            disabled, readOnly: bindProp
effects:    focusCell (while gridFocused: env.focus on the focused cell, non-pointer only),
            prepareAnnouncer (mount), insideWatch (while anchored, as Range Calendar) → LEAVE
```

- **Why two states.** `anchored` changes what a press means and enables preview, Escape and leave
  (Range Calendar's reasoning); grid focus is a flag because it only decides announcing and moving DOM
  focus, and it is orthogonal to the anchor (Calendar's `focused` state cannot coexist with `anchored`
  without a product state). Single mode never leaves `idle`.
- **Not stealing focus (react-spectrum#9427).** `focusCell` runs only while `gridFocused`; a
  `$sync:focusedValue` changes `pageStart` and the focused cell's `tabindex` but nothing calls `focus()`.
- **`emit`** = `toEmitted(setUnit(base, period), base)`: take the current value (or the placeholder /
  default), set month (year) from the period, `constrain` the day to the new month's length, keep type,
  calendar, time and zone. Comparison everywhere is `compareAt(unit)`.
- **Range** applies `makeRange` etc. to period starts; the end is the period (day kept per `emit`), so
  `end ≥ start` is compared at the unit.

### 5. Connect

| Part | Attributes / handlers |
|---|---|
| Root | `role="group"`, name per spec, `dir`, `lang`, `data-*` |
| Heading | `id`, text = `messages.heading(formatted page)` (year; first–last year via `formatRange`) |
| Prev/NextTrigger | `button-like-element`, `aria-label`, `aria-disabled` when `!canPage`, press → `PAGE` |
| Grid | `role="grid"`, `aria-labelledby` heading, `aria-multiselectable` (range), `aria-readonly`, `aria-disabled`; focusin/out → `GRID.FOCUS/BLUR`; keydown → `toLogicalKeyEvent(e, { orientation: "grid", dir })` (arrows), PageUp/PageDown, Home/End → `NAVIGATE`; Enter/Space → `SELECT_FOCUSED`; Escape → `CANCEL` while anchored |
| Body/Row | implicit roles; rows from `columns` |
| Cell | `td` gridcell, `tabIndex` 0/-1/absent, `aria-label`, `aria-selected` true/false, `aria-disabled`, `aria-current="date"`, `aria-describedby` → prompt node (range, focused cell only); text = month in `monthFormat` / the `year` part; press and hover handlers as Calendar's |

### 6. Contract, driver and model-based tests

- Keyboard path of `select(period)`: PageUp/PageDown to the target year (month) or page (year), then
  arrow keys, using `period-navigation` so it is exact for any `columns`, RTL and 13-month years.
- Configurations: month single `en-US`; month with `columns` 3; year single and `yearsPerPage` 10;
  month and year range; min/max within adjacent years; `isMonthUnavailable` August; `ar-EG` RTL;
  `th-TH` buddhist and `he-IL-u-ca-hebrew` (13 months) with `createCalendar`; japanese era boundary
  (year); read-only; disabled by prop step; value `CalendarDateTime` and `ZonedDateTime` (type and time
  kept); inside a dialog (Announcer, Escape bubbling); header `<select>` fixture (controlled
  `focusedValue`, no focus theft); shadow-root host for range leave.
- `virtual` modality: bare clicks select; programmatic focus never selects.

### 7. Theme

`month-picker.css` and `year-picker.css`: root `panel`, cells `collection item`;
`--rind-month-picker-cell-height`, `-cell-radius`, `-selected-bg`/`-text`, `-current-border`,
`-range-bg`, `-preview-border` (dashed), `-muted-text`; the grid is a `table` with
`border-spacing` for gaps; `data-size` scales cells; `font-variant-numeric: tabular-nums` for years;
forced-colors rules per state (selected `Highlight`, current a border, unavailable strike-through,
disabled `GrayText`, range middle `Highlight`, preview dashed `CanvasText`). `year-picker.css` repeats
the selectors on scope `year-picker` with `--rind-year-picker-*` tokens defaulting to the same
semantic tokens.

## Requests to other changes

- **add-calendar** (`calendar.pieces.ts`) — APPLIED (coordinator, 2026-10-15) — export the focused-value controllable factory, the
  `focusCell`/`prepareAnnouncer` effects and the announce-on-page action as reusable pieces (the
  Calendar change already says Range Calendar reuses them; the pickers are two more users). No behaviour
  change.
- **add-range-calendar** (`range-calendar.range.ts`) — APPLIED (coordinator, 2026-10-15) — keep `makeRange`, `availableBounds` and
  `crossesUnavailable` generic over comparable dates (they take the comparison as an argument or work on
  `CalendarDate`s), so the pickers can pass period starts; export the `insideWatch` effect and the
  prompt messages as pieces.
- **add-theme-system** (`theme-variants`) — APPLIED (coordinator, 2026-10-15) — list Month Picker and Year Picker in the family matrix
  (root `panel`, cells `collection item`), as Calendar and Range Calendar.
- **add-calendar** (optional, not blocking) — DEFERRED (coordinator) — a `ViewTrigger` part or `view` prop letting the Heading
  switch the Calendar to a month or year grid (Ark's model); until then the documented composition is
  used.

## Risks / Trade-offs

- [Standalone components instead of Calendar views] → a Calendar consumer who wants drill-down writes
  a small composition; the pickers' controlled `focusedValue` makes it a recipe, and a `ViewTrigger` can
  follow.
- [Emitting the old day, not the first of the month] → the unit-granular value rule makes day irrelevant
  to equality; it is what two bug reports asked for (reka-ui#2587/#2588); consumers needing day 1 use
  `placeholderValue` with no `value`, or normalise in `onValueChange`.
- [Home/End by page, not row] → a 12-cell page has no useful row edges and no new logical key is needed;
  row edges are reachable with arrows.
- [`aria-current="date"` on a month or year] → the nearest ARIA token; device check shared with Calendar.
- [Fixed year partitions look arbitrary (2016–2027)] → paging never drifts; a consumer wanting the focus
  year first sets `yearsPerPage` to a divisor-friendly size (10) or controls `focusedValue`.

## Open Questions

- Drill-down part in Calendar (request above); drag in range mode; quarters — all on request.
