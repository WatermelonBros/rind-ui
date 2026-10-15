## Context

[calendar.md](../../../docs/research/calendar.md) holds the comparison and the bug history.
This change builds on, and does not re-specify:

| Change | What Calendar uses |
|---|---|
| `add-foundations` (archived specs) | `setup()`/`machine()`, `controllable()` (`value`, `focusedValue`), `$sync`/`$reverted`, `ChangeDetails.cancel()`, effects, environment capabilities, contracts (`{ skip }`, prop steps), drivers, `testMachine`, the `selectable` and `composite-roving` traits |
| `add-a11y-foundations` | `keyboard-interactions` (`toLogicalKeyEvent`, IME guard; see Requests for the grid orientation), `press-interactions` (press on release, hover from mouse/pen only), `interaction-modality` (`data-focus-visible`, `focusSafely`), `announcer` (keyed polite, `prepare()` on mount), `i18n-messages` (locale, direction, `messages`, cached formatters), `element-ids`, `a11y-quirks`, `platform-and-preferences` (reduced motion for scrolling) |
| `add-collections` | only the `composite-roving` rule and the `selectable` trait wiring (`collection-testing`); not the collection model or navigation (§2) |
| `add-button` | `button-like-element` for the triggers (`aria-disabled` + focusable) |
| `add-overlay-infrastructure` | nothing directly; a Calendar inside a dialog relies on the Announcer being outside `inert` (`outside-inert` keep-visible list) |
| `add-theme-system` | stylesheet convention, families `panel` and `collection item` (see Requests) |

## Goals / Non-Goals

**Goals:**
- One date foundation (`date-values`) and one date-grid navigation module, both DOM-free and
  tested in Node, reused by every later date component.
- A Calendar machine whose context holds dates only (no `Date`, no DOM), with grids derived in
  `view()`.

**Non-Goals:**
- Month/year views, week numbers, form participation (proposal Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/
├─ i18n/date.ts                     date-values: re-exports, resolveCalendar(locale, createCalendar),
│                                   today(clock, zone), firstDayOfWeek(locale, prop), isWeekend,
│                                   dateFormatter(locale, options) (cached), toEmitted(value, base)
├─ env/capabilities.ts              + DateClock { now(): number; timeZone(): string }
├─ dom/environment                  + domEnvironment().dateClock (Date.now, Intl resolved zone)
└─ components/calendar/
   ├─ calendar.navigation.ts        calendar-navigation (pure): move, page, align, initialFocus
   ├─ calendar.grid.ts              weeks(month, firstDay, fixedWeeks) → cells (pure)
   ├─ calendar.machine.ts
   ├─ calendar.pieces.ts            context fields, events, actions, guards, effects reused by Range Calendar, Month Picker and Year Picker
   │                                  (exported: focused-value controllable factory, `focusCell` / `prepareAnnouncer` effects,
   │                                  announce-on-page action; requested by add-month-year-picker, no behaviour change)
   ├─ calendar.connect.ts
   ├─ calendar.contract.ts          contract + calendarInvariants
   └─ calendar.messages.ts
packages/react/src/calendar/        Root, Header, Heading, PrevTrigger, NextTrigger, Grid, GridHeader,
                                    HeaderCell, GridBody, Row, Cell
packages/testing/src/               getCalendar (generated from the contract)
packages/theme/src/calendar.css
```

`@internationalized/date` is imported only by `i18n/date.ts` and the calendar modules; the
default `createCalendar` is `() => new GregorianCalendar()` so other systems are tree-shaken
unless the consumer passes `createCalendar` from the package (react-spectrum's design;
reka-ui#1676 asks for exactly this).

### 2. Why not a `collection-grid` extension

`add-collections` deferred two-dimensional navigation to "the first of Grid List, Calendar,
Table". A calendar does not fit the collection model: it has no finite item set (it pages
forever), its items are dates computed from (month, first day of week), the same date appears
twice across adjacent grids (placeholders), and its moves are calendar arithmetic (month with
day clamping, year, week edges by the locale's first day, constraints by date) with no row or
column index meaning. Reka's DOM-driven navigation (query the target cell, page if absent,
retry next tick) is the alternative we reject: it couples navigation to rendering and cannot
run in Node. So `calendar.navigation.ts` is a pure module over `CalendarDate`s:

```ts
type CalendarMove = "next-day" | "previous-day" | "next-week" | "previous-week"
  | "week-start" | "week-end" | "next-month" | "previous-month" | "next-year" | "previous-year"
interface NavigationOptions {
  visibleMonths: number; pageBehavior: "visible" | "single"
  minValue: CalendarDate | null; maxValue: CalendarDate | null
  locale: string; firstDayOfWeek: DayOfWeek; calendar: Calendar
}
function move(focused: CalendarDate, visibleStart: CalendarDate, m: CalendarMove, o: NavigationOptions)
  : { focused: CalendarDate; visibleStart: CalendarDate }
function page(focused, visibleStart, direction: 1 | -1, o): { focused; visibleStart } | null  // null: blocked
function initialFocus(value, today, o): { focused; visibleStart }
function canPage(visibleStart, direction, o): boolean
```

Grid List and Table remain the first users of a future `collection-grid` extension; nothing
here blocks it.

### 3. Machine

```ts
type CalendarEvent =
  | { type: "NAVIGATE"; move: CalendarMove; modality: "keyboard" }   // from logical keys
  | { type: "CELL.FOCUS"; date: CalendarDate; modality: Modality }   // DOM focus on a cell
  | { type: "CELL.PRESS"; date: CalendarDate; modality: Modality }   // press-interactions PRESS
  | { type: "CELL.HOVER"; date: CalendarDate } | { type: "GRID.HOVER_END" }
  | { type: "SELECT_FOCUSED"; modality: "keyboard" }                 // Enter / Space
  | { type: "PAGE"; direction: 1 | -1; modality: Modality }          // triggers
  | { type: "GRID.FOCUS"; modality: Modality } | { type: "GRID.BLUR" }

states:
  idle     ── GRID.FOCUS ──► focused
           ── PAGE [canPage] / page, announceVisibleRange
           ── CELL.PRESS [selectable] / focusCell, select            (pointer press focuses too)
  focused  ── GRID.BLUR ──► idle
           ── NAVIGATE [notComposing] / move                         (effect focuses the cell)
           ── CELL.FOCUS / setFocused                                (no selection: cause C)
           ── CELL.PRESS [selectable] / setFocused, select
           ── SELECT_FOCUSED [selectable, !readOnly] / select
           ── PAGE [canPage] / page                                  (no announcement: cell names carry it)
  global   CELL.HOVER / setHovered · GRID.HOVER_END / clearHovered
           $sync:value / keepRangeIfSameDay · $sync:focusedValue / constrain, realign
           $props:minValue|maxValue|locale|createCalendar|visibleMonths / constrain, realign
values:    value: controllable("value", { fallback: null, equal: sameDays })   // by day, not identity
           focusedValue: controllable("focusedValue", { fallback: initialFocus, equal: isSameDay })
           disabled, readOnly: bindProp
effects:   focusCell (while focused: env.focus on the focused cell with modality, scroll nearest,
           instant, non-pointer only), prepareAnnouncer (on mount)
```

- **Why two states.** Only "is the grid focused" changes behaviour (announce or not, move DOM
  focus or not). Hover, the visible start and the focused date are context.
- `visibleStart` is context (not controllable): the focused date drives it, exactly as React
  Aria (react-spectrum#7005 was answered with `focusedValue`). `onVisibleRangeChange` is a
  watch on it.
- `select` builds the emitted value with `toEmitted(date, currentValue)` (`date-values`): the
  caller's calendar, type and time of day.
- `sameDays` compares single values with `isSameDay` and arrays element-wise, so a new object
  for the same day does not realign (reka-ui#2960).
- The machine runs in Node: today comes from `env.dateClock`; grids are not in context but
  computed in `view()` from `visibleStart`, `visibleMonths`, first day and `fixedWeeks`.

### 4. Connect

| Part | Attributes / handlers |
|---|---|
| Root | `role="group"`, name per spec, `dir`, `lang`, `data-*` |
| Heading | `id` (`element-ids`), text = `messages.visibleRange(formatRange(visible))` |
| Prev/NextTrigger | `button-like-element` props, `aria-label` from messages, `aria-disabled` when `!canPage`, press → `PAGE`; `aria-controls` = the grids' ids |
| Grid | `role="grid"`, `aria-labelledby` heading (1 month) or `aria-label` from `monthLabel`, `aria-multiselectable`, `aria-readonly`, `aria-disabled`; `focusin`/`focusout` (relatedTarget outside the grid) → `GRID.FOCUS`/`GRID.BLUR`; keydown → `toLogicalKeyEvent(e, { orientation: "grid", dir })` → `NAVIGATE` (see Requests), PageUp/PageDown with `shift` → year moves, Enter/Space → `SELECT_FOCUSED`; `preventDefault` only when handled |
| GridHeader | `aria-hidden="true"` |
| HeaderCell | weekday in `weekdayFormat` (`narrow` default), `abbr` = long weekday |
| Cell | `role` implicit (`td` in `grid`), `tabIndex` 0/-1/absent, `aria-label`, `aria-selected` true/false, `aria-disabled`, `aria-current="date"`, `aria-invalid`; text = `day` part; `focus` → `CELL.FOCUS` with modality; press handlers (`press-interactions`, `preventFocusOnPress` false) → `CELL.PRESS`; hover handlers (`core/dom/hover`) → `CELL.HOVER` |

The full date label and the day text come from two cached formatters per (locale, calendar,
era need); the era is included when the calendar has several eras or the date is BC in
gregorian.

### 5. Contract, driver and model-based tests

- `select(date)` keyboard path: the contract computes it from `focusedDate()` and the target
  with `calendar-navigation` (years by Shift+PageUp/Down, months by PageUp/Down, then days by
  arrows), so the keyboard twin is exact in every locale and in RTL.
- Configurations: `en-US` one month; `en-GB` (Monday weeks); `visibleMonths={2}`
  `pageBehavior="single"`; `selectionMode="multiple"`; min/max; `isDateUnavailable` weekends;
  `ar-EG` `dir="rtl"`; `th-TH` buddhist and `fa-IR` persian with `createCalendar`;
  `ja-JP-u-ca-japanese` across the Heisei/Reiwa boundary (April–May 2019); read-only; disabled
  by prop step; fixed clock at 2026-10-14 and a second clock at 23:30 UTC with
  `Pacific/Auckland`.
- `virtual` modality: bare clicks select (invariant 12); programmatic focus never selects
  (invariant 13).

### 6. Theme

`calendar.css`: root `panel` look (`--rind-calendar-bg`, `--rind-calendar-border`,
`--rind-calendar-radius`, padding from density), cells `collection item` look
(`--rind-calendar-cell-size` default `max(2.25rem, 24px)`, `--rind-calendar-cell-radius`,
selected via `--rind-calendar-selected-bg`/`-text` + an edge in `border`, today border
`--rind-calendar-today-border`, unavailable `text-decoration: line-through`, placeholders
`--rind-calendar-muted-text`), heading typography, triggers reuse the `toggle item` ghost look
through their own `--rind-calendar-trigger-*` tokens, `data-tone="danger"` on invalid,
`font-variant-numeric: tabular-nums`, forced-colors rules per state, `data-size` scales the cell
size.

## Requests to other changes

- **add-a11y-foundations** (`keyboard-interactions`) — RECORDED in docs/review-pending.md items 12–13: add an orientation for two-dimensional
  composites (`"grid"`), in which ArrowLeft/ArrowRight map to `PREV`/`NEXT` (mirrored in RTL)
  and ArrowUp/ArrowDown map to two new logical keys `PREV_ROW`/`NEXT_ROW` (never mirrored).
  Today `orientation: "both"` maps both axes to `NEXT`/`PREV`, so a grid cannot tell a day
  from a week. Calendar is the first user; Grid List and Table will be the next.
- **add-a11y-foundations** (`a11y-quirks`) — RECORDED in docs/review-pending.md items 12–13: reserve the entry id `nvda-calendar-focus-mode`
  (condition: Windows; fallback `role="application"` on the Calendar root; links
  react-spectrum#4637, reka-ui#2228, reka-ui#2438) — added only if the device check in Open
  Questions fails.
- **add-theme-system** (`theme-variants`) — APPLIED (coordinator, 2026-10-14): list Calendar (root in `panel`, cells in
  `collection item`) and, for the coming changes, Range Calendar (same), Date Field and Time
  Field (`field`) in the family matrix.

## Risks / Trade-offs

- [Focus on the gridcell instead of an inner button differs from four libraries] → it is APG's
  model, it removes the cause of react-spectrum#4637/reka-ui#2438 without `role=application`
  (reka-ui#2228); device check before `done`, and a reserved quirk if NVDA disagrees.
- [`aria-current="date"` instead of "Today" in the name] → states announced natively; device
  check on the four tier-1 ATs; `messages.cellLabel` receives `{ today }` so a consumer can add
  the word.
- [Home/End by week (APG) differ from React Aria/Zag (month)] → APG is the reference; month
  edges stay reachable with PageUp/PageDown + arrows.
- [Only gregorian bundled] → `createCalendar` documented; a dev warning names the missing
  system.

## Open Questions

- NVDA (2025.x + Chrome, Firefox) focus mode with the cell-focus model: if it leaves focus mode
  on arrow keys, enable `nvda-calendar-focus-mode` (only the quirk's condition changes).
- `aria-current="date"` speech on JAWS, NVDA, VoiceOver (macOS, iOS) and TalkBack.
</content>
</invoke>
