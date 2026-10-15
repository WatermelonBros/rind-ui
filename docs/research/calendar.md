# Calendar — research

Status: done · Wave: 3 (Calendar in Ark/Zag as the inline Date Picker, React Aria, Reka UI, Bits UI)

The first date component, so this note also decides the **shared date infrastructure** every
later date component builds on (Range Calendar, Date Field, Time Field, Date Picker, Date
Range Picker, Date Range Field, Time Range Field, Month/Year Picker): the value types, the
calendar system, the time zone, "today", the week, formatting, constraints and the date-grid
navigation. Range-specific behaviour is in [range-calendar.md](range-calendar.md); segmented
input in [date-field.md](date-field.md) and [time-field.md](time-field.md).

Cross-cutting: [accessibility.md](accessibility.md) §4.2 (roving tabindex for Calendar), §6
(logical keys, RTL flip only for horizontal arrows), §7 (the Announcer), §9 (dates through
`@internationalized/date` only; cells labelled with the full localised date; week start from
the locale); [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) §1.4
"Date fields / calendar", causes D (announcer must exist first), E (announcer hidden inside a
layer, RA#3559), I (`role=grid` label not read by VoiceOver, webkit 239920), K (forced
colours), L (AT regressions); [native-platform.md](native-platform.md) §8 (no visible native
date input). Collections: [collections.md](collections.md) deferred two-dimensional grid
navigation to "the first of Grid List, Calendar, Table" — this note answers that for the
calendar (it does not use `core/collection`, see Decisions). Reado does not use a calendar.

## Pattern

- WAI-ARIA APG: no standalone calendar pattern; the grid is specified inside the
  [Date Picker Dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
  (fetched 2026-10-14) and follows the [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
  pattern.
- Roles and attributes (APG example): `table[role=grid]` named by `aria-labelledby` → the
  month/year `h2`; `td` cells are the focusable `gridcell`s with roving `tabindex` (one cell
  `0`, all others `-1`); `aria-selected="true"` only on the selected cell; the heading carries
  `aria-live="polite"` so the new month is spoken; navigation buttons are named
  ("Previous Month", "Next Year"). The example does **not** use `aria-current` and has no
  marker for today.
- Keyboard (APG grid of the date picker):

| Key | Action |
|---|---|
| ArrowRight / ArrowLeft | next / previous day (mirrored in RTL) |
| ArrowDown / ArrowUp | same weekday next / previous week |
| Home / End | first / last day of the current week |
| PageUp / PageDown | previous / next month, same day number or the last day of a shorter month |
| Shift+PageUp / Shift+PageDown | same month previous / next year, same day rule |
| Enter / Space | select the focused date |

- WCAG: 1.3.1 (grid structure), 1.4.1 (selected, today, unavailable never by colour only),
  2.1.1 (every pointer path has a key path), 2.4.3 (focus order: triggers, then one grid
  stop), 2.4.7, 2.5.8 (cells ≥ 24×24), 3.3.1 (an unavailable or out-of-range value is
  identified), 4.1.2, 4.1.3 (month change announced).

## How the others built it

### React Aria (`react-stately/src/calendar/useCalendarState.ts`, `utils.ts`; `react-aria/src/calendar/{useCalendarBase,useCalendar,useCalendarGrid,useCalendarCell,utils}.ts`; `react-aria-components/src/Calendar.tsx`; `@internationalized/date/src/*`)

- Parts (RAC): `Calendar` (root `div`), `Heading`, `Button slot=previous|next`,
  `CalendarGrid` (`table`), `CalendarGridHeader` / `CalendarHeaderCell`, `CalendarGridBody`,
  `CalendarCell`; `Text slot=errorMessage`. Multiple months: one `CalendarGrid` per month
  with `offset={{months: n}}` and `visibleDuration={{months: n}}` on the root.
- State: controllable `value` (`DateValue | null`, or an array with `selectionMode=
  "multiple"`, added recently), controllable `focusedValue` (`defaultFocusedValue`,
  `onFocusChange`) separate from the value, and an internal `startDate` (first visible day)
  realigned whenever the focused date leaves the visible range (`alignStart/End/Center`).
  `selectionAlignment` decides where the selected month sits among several visible months;
  `pageBehavior: "visible" | "single"` decides whether the triggers page by all visible
  months or by one. `minValue`/`maxValue` (inclusive), `isDateUnavailable(date)`,
  `isDisabled`, `isReadOnly`, `isInvalid`, `firstDayOfWeek: "sun" | "mon" | …`,
  `createCalendar(identifier)` injected so only the needed calendar systems are bundled.
- Calendar system: from the locale's resolved `calendar` (`th-TH` → buddhist, `ja-JP-u-ca-
  japanese`, `fa-IR` → persian). **Values keep the caller's calendar and type**:
  `normalizeValue` converts the selected display date back to the calendar of the original
  value (default gregorian) and keeps the time of a `CalendarDateTime`/`ZonedDateTime`
  value (`baseValue.set(calendarValue)`). The time zone comes from a `ZonedDateTime` value,
  else the formatter's resolved zone.
- Grid: `role=grid`, `aria-readonly`, `aria-disabled`, `aria-multiselectable` (range or
  multiple), named by the root's `aria-label` + the visible range text
  ("October 2026" / "October to November 2026"). Weekday header `aria-hidden` ("the day names
  are already included in the label of each cell"). Weekday names via `DateFormatter
  ({weekday: "narrow"})` from `startOfWeek(today, locale, firstDayOfWeek)`.
- Cell: `td[role=gridcell]` with `aria-selected`, `aria-disabled`, `aria-invalid`; inside it
  a `div[role=button]` that holds focus, roving `tabIndex`, `aria-label` = full date
  ("Wednesday, October 14, 2026") wrapped by messages: "Today, {date}", "{date} selected",
  "First available date"/"Last available date"; range prompts in `aria-describedby`. Press
  on release (`usePress`, `preventFocusOnPress`), focus moved by an effect when the focused
  date changes (`focusWithoutScrolling`, scroll into view only when modality ≠ pointer).
  Day number via `formatToParts(...).find(type === "day")` (RA#4135: `day: "numeric"`
  formats as "14日" in Japanese).
- Keyboard: `useCalendarGrid` — arrows (Left/Right swapped in RTL), PageUp/PageDown = month,
  Shift = year, **Home/End = first/last day of the month** (`focusSectionStart/End`), not the
  week as APG says; key repeat allowed; Escape clears a range anchor.
- Root (`useCalendarBase`): **`role="application"`** (was `group` until RA#4637: NVDA left
  focus mode on the cell button and read the whole calendar); `aria-label` including the
  visible range; the **visible range is announced** through `LiveAnnouncer` only when the
  grid is not focused (i.e. after a trigger press); the selected date is announced on
  change ("Selected Date: …", polite, 4 s). If a trigger becomes disabled while focused,
  focus moves to the grid. RAC adds a **visually hidden `h2`** with the full label first in
  the DOM ("VoiceOver on iOS does not announce the aria-label of the grid elements") and a
  **visually hidden "Next" button after the grid** for touch screen readers.
- Outside-month days: rendered empty or disabled; RA#3257 explains why they are never
  selectable (duplicates across multiple months, ranges, focus).
- Notable: the most complete date model; `@internationalized/date` is theirs; everything is
  derived from `focusedDate` + `visibleDuration`.
- Problems: RA#3975/RA#5246 (several cells show focus rings — the recipe combined
  `isFocused` with a separate focus-visible tracker), RA#5692 (Enter on an unavailable date
  selected the previous available date), RA#7779 (`selectDate` ignored for a future month
  with `isDateUnavailable`, uncontrolled), RA#8017 (`zh-CN-u-ca-chinese` crashes on the
  `relatedYear` part), RA#4614 (`min`/`max` + `visibleDuration` disable cells inside the
  range), RA#9786 (`Date.now()` at module scope → hydration mismatch).

### Ark UI / Zag (`zag/packages/machines/date-picker/src/*`, `utilities/date-utils`)

- No separate calendar: the Date Picker machine with `inline: true` is the calendar
  (Ark `DatePicker.Root inline`). States `idle`, `focused`, `open`; views `day`, `month`,
  `year` (`minView`/`maxView`, `VIEW.TOGGLE`); value is **always an array**
  (`selectionMode: "single" | "multiple" | "range"`); bindables `focusedValue`, `value`,
  `view`, `startValue` (first visible day), `hoveredValue`.
- Props: `locale` (default `"en-US"`), **`timeZone` (default `"UTC"`)**, `numOfMonths`,
  `startOfWeek` (number), `fixedWeeks`, `min`/`max`, `isDateUnavailable`,
  `outsideDaySelectable`, `createCalendar`, `format`/`parse` for its input,
  `translations` (typed English defaults).
- Connect: content `role=application` with a translated label; table `role=grid`,
  `aria-label` = visible range text, `aria-multiselectable`; cell `role=gridcell` with
  `aria-selected` (selected **or in range**), `aria-disabled`, `aria-invalid`,
  **`aria-current="date"` for today**; inner trigger `role=button` with
  `translations.dayCell(state)` label; week numbers as `rowheader`.
- Keyboard: arrows, PageUp/PageDown with `larger: shiftKey`, Home/End = first/last visible
  day (`focusSectionStart/End`).
- Announcements: a `createLiveRegion` per machine announces the selected value text.
- Problems: ZG#1208 (number of weeks computed from the locale's week start, not
  `startOfWeek`), ZG#2474 (unavailable dates focusable — confirmed by design for
  discoverability), ZG#3336 (year view disabled every year outside the decade with no
  min/max), ZG#3420 (`aria-roledescription` and placeholder letters bypassed translations),
  ARK#2270 (today shown on the wrong day: `timeZone` default `"UTC"` vs the viewer),
  ARK#3725 (locale change did not reformat the displayed value).

### Reka UI (`Calendar/{CalendarRoot,CalendarGrid,CalendarCell,CalendarCellTrigger,CalendarHeading,…}.vue`, `useCalendar.ts`, `date/*`, `shared/date/*`)

- Parts: `Root`, `Header`, `Heading`, `Prev`, `Next`, `Grid`, `GridHead`, `GridBody`,
  `GridRow`, `HeadCell`, `Cell`, `CellTrigger`. Value `modelValue` (single, or array with
  `multiple`), **`placeholder`** = the focused/visible date, controllable separately.
- Props: `weekStartsOn` (0–6 **relative to the locale's first day**, RK#2157/RK#2264),
  `fixedWeeks`, `numberOfMonths`, `pagedNavigation`, `preventDeselect` (re-pressing the
  selected date deselects by default), `isDateDisabled` vs `isDateUnavailable`,
  `disableDaysOutsideCurrentView`, `weekdayFormat`, `calendarLabel`, `initialFocus`.
- Navigation is **DOM-driven**: `CellTrigger` queries `[data-value='…']` for the target and,
  when it is not rendered, pages and retries on `nextTick`; disabled targets are skipped by
  recursion. Home/End follow APG (week boundary).
- Cell trigger `role=button` with the full date `aria-label`; today via
  `isToday(day, getLocalTimeZone())` (the viewer's zone, not the value's).
- Root renders a visually hidden `div[role=heading][aria-level=2]` with the full label.
  `CalendarGrid` has **`role="application"`**: removed in RK#2228 ("a screen reader user was
  confused"), then NVDA arrow keys walked the DOM in browse mode (RK#2438) and it was put
  back.
- Problems: RK#2960 (month paging undone when the parent passes a new object for the same
  day), RK#2422 (ISO week numbers wrong for de-DE), RK#1475 (`ar-SA` broke the picker),
  RK#2157/RK#2264 (week start index meaning depends on the locale — confusing).

### Bits UI (`bits/calendar/calendar.svelte.ts`, `internal/date-time/*`)

- Melt-UI heritage, same anatomy as Reka (`Root`, `Header`, `Heading`, `PrevButton`,
  `NextButton`, `Grid`, `GridHead`, `GridRow`, `HeadCell`, `Cell`, `Day`). Value + a
  `placeholder` date; `weekStartsOn`, `fixedWeeks`, `numberOfMonths`, `pagedNavigation`,
  `disableDaysOutsideMonth`, `maxDays` (multiple), `calendarLabel`, `initialFocus`.
- `gridcell` with `aria-selected`/`aria-disabled`, inner `role=button` with the full label;
  prev/next with hard-coded `aria-label="Next"`/`"Previous"`.
- Own announcer (`internal/date-time/announcer.ts`): two `log` regions, **assertive by
  default**, announces "Selected date is now empty." and the selected date.
- Problems: BITS#768 (a weekday shifted around a month boundary), BITS#2022 (weekday headers
  shift by a day with `ZonedDateTime` values ahead of the local zone), BITS#1262 (opens on a
  future month when only past dates are allowed), BITS#1358 (time part of a
  `CalendarDateTime` value reset on date selection), BITS#1389 (`disableDaysOutsideMonth=
  {false}` ignored), BITS#902 (focusable month/year selects inside an `aria-hidden` header),
  BITS#2044 (`data-selected` shared with Command item meanings; `:has([data-selected])` style
  recalcs).

### Kobalte, Base UI, Radix, Headless UI, Ariakit

No calendar. Kobalte has an open request (KB#305) and ships Time Field only; Base UI tracks
"Calendar and Date Fields primitives" (BU#1709, open); Radix closed its DatePicker request
(RX#1503); Ariakit has an open "DateTime Picker" request (AK#374).

### `@internationalized/date` (allowed dependency, decision in 0002)

Immutable `CalendarDate`, `CalendarDateTime`, `ZonedDateTime`, `Time`; 13 calendar systems
(`createCalendar`: gregory, buddhist, japanese, roc, persian, indian, islamic-civil,
islamic-tbla, islamic-umalqura, hebrew, ethiopic, ethioaa, coptic); `toCalendar`, `toZoned`,
`today(timeZone)`, `now(timeZone)`, `startOfWeek(date, locale, firstDayOfWeek)`,
`getWeeksInMonth`, `getDayOfWeek`, `isWeekend(date, locale)`, `isSameDay`, `isToday`,
`getLocalTimeZone()`; `DateFormatter` (an `Intl.DateTimeFormat` wrapper that fixes `hour12`/
`hourCycle` bugs and adds `formatRange` fallbacks); ISO `toString()` / `parseDate` /
`parseDateTime` / `parseZonedDateTime` / `parseTime`. Week start data from CLDR
(`weekStartData.ts`). Known engine bugs it cannot fix: dates before 1582 are formatted with
the Julian calendar by all three engines (RA#6536, tc39/ecma402#1003, fixed in Firefox 139),
Persian conversion bug fixed upstream (RA#3757). No Chinese/Dangi calendar (RA#8017).

## Accessibility

- **Grid semantics.** `role=grid` on a `table` (implicit `row`, `gridcell` from `tr`/`td`);
  one roving tab stop (accessibility.md §4.2); the grid is named by its month heading
  (`aria-labelledby`), and the root group by the consumer's label plus the visible range.
  Weekday column headers are visual: the header row is `aria-hidden` because every cell's
  name already contains the weekday (RA, Zag, Bits), which also avoids touch screen readers
  stopping on seven header cells first.
- **Where focus lives: the cell itself, not a button inside it.** RA, Zag, Reka and Bits put
  focus on a `role=button` inside the `gridcell` and repeat state in its label ("Today,
  {date} selected"). That button is the reason NVDA leaves focus mode and reads the rest of
  the calendar (RA#4637; maintainer analysis: "NVDA shifts out forms mode when focus lands on
  the button within a cell"), and every library then added `role="application"` to the
  container (RA, Zag, Reka after the RK#2228 → RK#2438 round trip). `application` is a
  blunt instrument (RK#2228: a real screen-reader user was confused by it) and hides the
  grid's table navigation. The APG example focuses the `gridcell` and needs neither the
  button nor `application`. With focus on the cell, `aria-selected`, `aria-disabled` and
  `aria-current` belong to the focused element and are announced as states, so the label is
  only the date. Decision: focus on the gridcell; no `application` role by default; a quirk
  entry is ready if device testing reproduces RK#2438 on the cell-focus model (Open
  questions).
- **Cell names**: the full localised date (weekday, day, month, year; era when gregorian BC
  or a non-gregorian calendar with eras) from `DateFormatter`, through `messages.cellLabel`.
  Selected = `aria-selected="true"`, unselected selectable cells `aria-selected="false"`
  (collections invariant 9: VO reads every option as selected when absent, HUI#1599).
  Today = `aria-current="date"` (ARIA 1.2 value, used by Zag) rather than RA's "Today, …"
  text, which would be read twice with the state.
- **Disabled vs unavailable** are different states (RA#6108): *disabled* (outside min/max,
  outside the month, whole calendar disabled) cells are not focusable; *unavailable*
  (`isDateUnavailable`) cells stay focusable so a screen-reader user learns why a date
  cannot be picked (ZG#2474 by design, RA docs) and carry `aria-disabled="true"`; pressing
  them does nothing (RA#5692).
- **Announcing the month.** APG uses an `aria-live` heading; accessibility.md §7 forbids
  component-owned live regions, so the Announcer speaks the visible range when it changes
  while focus is **not** in the grid (trigger press, programmatic paging). When the grid has
  focus, the newly focused cell's name already contains the month and year, so a second
  announcement would double the speech (RA's rule). The Announcer exists before the first
  message (cause D) and outside every inert subtree (cause E, RA#3559: a lazily created
  announcer inside the popover's hidden tree never spoke).
- **VoiceOver iOS** does not read a grid's `aria-label`/`aria-labelledby` inside `main`
  (webkit 239920, AT note §1.3) → RAC's visually hidden heading placed first. We render the
  visible Heading as a real heading element (consumers see it), so the touch cursor meets
  the month name before the grid; no hidden duplicate is needed when the Heading part is
  rendered. RAC's hidden "next" button after the grid helps touch SR users page after the
  last cell; we keep it as an opt-in part (`NextTrigger` may be rendered twice — see
  Decisions) rather than an always-on hidden control.
- **Virtual cursor focus** (cause C): VO and iOS VO move focus as the cursor moves; focusing
  a cell must never select it. Selection is only on press or Enter/Space.
- **Touch**: press on release (2.5.2), scrolling a long multi-month list cancels the press
  (`pointercancel`); no hover state from touch; day targets ≥ 24×24 in the theme.
- **RTL**: Left/Right mirrored (logical keys), PageUp/Down never; the grid flows right to
  left via `dir`; weekday order unchanged (the first day of the week is the start edge).
- **Forced colours** (RA#3260, RA#2949): selected, today, unavailable and focus must survive:
  selected = `Highlight`/`HighlightText`, today = a border, unavailable = strike-through +
  `GrayText`, outside-month = `GrayText`, focus = outline.
- **Reduced motion**: month transitions are theme-only; scroll-into-view is `instant`.
- **Native primitive**: none. `<input type=date>`'s picker cannot be embedded, styled,
  constrained per date or localised by the app (native-platform §8).

## Bug history

Searched (2026-10-14) adobe/react-spectrum (35 queries: Calendar keyboard/VoiceOver/screen
reader/announce/month/firstDayOfWeek/time zone/RTL, isDateUnavailable, calendar systems,
min/max…), chakra-ui/zag and chakra-ui/ark (date picker, calendar), unovue/reka-ui and
huntabyte/bits-ui (Calendar, RangeCalendar, date picker), kobaltedev/kobalte, mui/base-ui,
radix-ui/primitives, tailwindlabs/headlessui, ariakit/ariakit ("date picker", "calendar").
About 480 hits, 130 read in full. Range-specific bugs are in
[range-calendar.md](range-calendar.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#4637](https://github.com/adobe/react-spectrum/issues/4637) | NVDA reads every day of the calendar after focusing a cell | focus on a `role=button` inside the cell makes NVDA leave focus mode | closed: root `role="application"` | focus the gridcell (APG); keep `application` as a quirk fallback only |
| RK | [#2228](https://github.com/unovue/reka-ui/issues/2228) | screen-reader user confused by `role="application"` | `application` hides document semantics | closed: removed (PR #2234) | `application` is not free; do not add it by default |
| RK | [#2438](https://github.com/unovue/reka-ui/issues/2438) | after removal, NVDA ArrowDown reads the next DOM cell instead of next week | browse mode intercepts arrows when focus is on an inner button | closed: `application` restored on the grid | the inner-button model is the trigger; test NVDA on our cell-focus model before shipping |
| RA | [#3559](https://github.com/adobe/react-spectrum/issues/3559) | month change announced only the first time the picker opens | announcer created lazily inside the popover's hidden tree | closed | Announcer prepared on mount, kept out of inert (announcer spec) |
| RA | [#3975](https://github.com/adobe/react-spectrum/issues/3975) | several cells show a focus ring after paging | focus-visible tracked per cell separately from the focused date | closed (recipe fix) | `data-focus-visible` only on the cell equal to the machine's focused date; invariant |
| RA | [#5246](https://github.com/adobe/react-spectrum/issues/5246) | multiple focused cells in RAC after month changes | same as #3975 | closed (dupe) | same invariant |
| RA | [#3257](https://github.com/adobe/react-spectrum/issues/3257) | days outside the month cannot be pressed | deliberate: duplicates across months and ranges | wontfix with rationale | outside-month days are placeholders, never selectable or focusable |
| RA | [#4135](https://github.com/adobe/react-spectrum/issues/4135) | "14日" / "14." in cells for ja, zh, ko, da, cs… | `day: "numeric"` formats with a suffix | closed: take the `day` part of `formatToParts` | cell text = the `day` part only |
| RA | [#5692](https://github.com/adobe/react-spectrum/issues/5692) | Enter on an unavailable date selects the previous available one | value normalisation searched backwards for availability | closed | pressing an unavailable date is a no-op; scenario |
| RA | [#6108](https://github.com/adobe/react-spectrum/issues/6108) | unavailable cells have `aria-disabled` but not `data-disabled` | deliberate: distinct states | closed (by design) | separate `data-unavailable` / `data-disabled`, documented |
| RA | [#7779](https://github.com/adobe/react-spectrum/issues/7779) | `selectDate(today)` ignored while a future month is shown (uncontrolled + `isDateUnavailable`) | normalisation bounded by the visible start | closed | selection never depends on the visible range |
| RA | [#8542](https://github.com/adobe/react-spectrum/issues/8542) | disabled calendar hides the selection except when invalid | `isSelected` forced false when disabled | closed (by design: use read-only) | disabled keeps `aria-selected`/`data-selected` truthful; read-only for display |
| RA | [#8017](https://github.com/adobe/react-spectrum/issues/8017) | `zh-CN-u-ca-chinese` throws `RangeError` | `relatedYear` part passed to `Intl.DisplayNames`; no Chinese calendar | closed | unsupported calendar systems fall back to gregorian with a dev warning; map `relatedYear` |
| RA | [#3757](https://github.com/adobe/react-spectrum/issues/3757) | Gregorian → Persian off by days | conversion bug | fixed upstream | conversion is `@internationalized/date`'s; pin a fixed version, test fa-IR |
| RA | [#6536](https://github.com/adobe/react-spectrum/issues/6536) | Buddhist calendar days change when the year changes | engines format pre-1582 dates with the Julian calendar | open (engine bugs filed) | document; tests avoid pre-1582 dates in non-gregorian calendars |
| RA | [#8557](https://github.com/adobe/react-spectrum/issues/8557) | `firstDayOfWeek` not forwarded by pickers | prop plumbing | closed | Date Picker will pass calendar props through one shared props type |
| RA | [#4614](https://github.com/adobe/react-spectrum/issues/4614) | cells inside min/max disabled when `visibleDuration` changes | cell disabled = outside the visible range | open | "disabled" from constraints only; outside-visible is a separate attribute |
| RA | [#9016](https://github.com/adobe/react-spectrum/issues/9016) | cannot page by an arbitrary number of months | `pageBehavior` is visible or single only | open | `pageBehavior` `visible`/`single` is enough; custom paging via controlled `focusedValue` |
| RA | [#3260](https://github.com/adobe/react-spectrum/issues/3260) | selected/unavailable/range invisible in forced colours | states by background only | closed (theme) | theme rules per state under `forced-colors` |
| RA | [#2949](https://github.com/adobe/react-spectrum/issues/2949) | Windows High Contrast issues (calendar listed) | colour-only states | open | same |
| RA | [#9786](https://github.com/adobe/react-spectrum/issues/9786) | hydration mismatch from `Date.now()` at module scope | non-deterministic ids | closed | no time read at module scope; "now" through the environment |
| RA | [#4711](https://github.com/adobe/react-spectrum/issues/4711) | date/time order wrong in RTL (zoned calendar story, fields) | flex layout + placeholders broke the bidi algorithm | closed | inline flow, numeric parts `dir=ltr`, isolates (date-field.md) |
| ZG | [#1208](https://github.com/chakra-ui/zag/issues/1208) | wrong number of week rows with `startOfWeek` | weeks counted with the locale's start | closed | one first-day value used everywhere (rows, headers, Home/End) |
| ZG | [#2474](https://github.com/chakra-ui/zag/issues/2474) | unavailable dates still reachable by arrows | deliberate (feedback for SR users) | closed by design | same decision: unavailable focusable, disabled not |
| ZG | [#3336](https://github.com/chakra-ui/zag/issues/3336) | year view disables years outside the decade without min/max | "outside visible" mixed into "disabled" | closed | same lesson as RA#4614 |
| ZG | [#3420](https://github.com/chakra-ui/zag/issues/3420) | `aria-roledescription` and placeholder stay English | strings outside `translations` | closed | every AT string through `messages`; no `aria-roledescription` |
| ARK | [#2270](https://github.com/chakra-ui/ark/issues/2270) | "today" marker on the wrong day | `timeZone` default `"UTC"` vs the viewer's zone | closed | today = the environment's now in the resolved zone (viewer's by default) |
| ARK | [#3725](https://github.com/chakra-ui/ark/issues/3725) | locale change does not reformat the shown date | formatted text cached | closed | every label/heading derived from (value, locale) on each render |
| RK | [#2157](https://github.com/unovue/reka-ui/issues/2157) | `weekStartsOn=1` means Monday in en-US, Tuesday in en-GB | index relative to the locale's first day | closed (by design) | `firstDayOfWeek` takes a weekday name, never an index |
| RK | [#2264](https://github.com/unovue/reka-ui/issues/2264) | `weekStartsOn=1` + cs-CZ starts on Tuesday | same | closed (dupe) | same |
| RK | [#2422](https://github.com/unovue/reka-ui/issues/2422) | ISO week numbers wrong for de-DE | US week numbering applied | closed | week numbers are a non-goal now; when added, ISO 8601 by locale |
| RK | [#2960](https://github.com/unovue/reka-ui/issues/2960) | paging undone when the parent passes a new object for the same day | value change detected by identity, refocused | closed | `$sync` compares dates by day value, not identity |
| RK | [#1475](https://github.com/unovue/reka-ui/issues/1475) | `ar-SA` breaks the picker | islamic-umalqura calendar + digits not handled | closed | model test configuration `ar-SA` (umalqura, arab digits) |
| BITS | [#768](https://github.com/huntabyte/bits-ui/issues/768) | 2 Dec 2024 shown on Sunday | grid built with local `Date` arithmetic across DST | closed | grid built from `CalendarDate` only, no `Date` arithmetic |
| BITS | [#2022](https://github.com/huntabyte/bits-ui/issues/2022) | weekday headers shift by a day with `ZonedDateTime` | headers from a zoned instant converted in the local zone | open | grid works on `CalendarDate`; headers from the same first-day date |
| BITS | [#1262](https://github.com/huntabyte/bits-ui/issues/1262) | opens on a future month when only past dates allowed | default visible month = today | closed (use placeholder) | initial focused date = value, else today **constrained to min/max** |
| BITS | [#1358](https://github.com/huntabyte/bits-ui/issues/1358) | time part of a `CalendarDateTime` reset on date selection | new value built from the date only | closed | selecting keeps the value's time and type (RA `normalizeValue`) |
| BITS | [#1389](https://github.com/huntabyte/bits-ui/issues/1389) | `disableDaysOutsideMonth={false}` ignored | prop plumbing | closed | no such prop: outside days are never selectable (RA#3257) |
| BITS | [#902](https://github.com/huntabyte/bits-ui/issues/902) | focusable selects inside an `aria-hidden` header | header hidden to avoid double reading | closed | only the weekday row is `aria-hidden`; the Header part never is |
| BITS | [#2044](https://github.com/huntabyte/bits-ui/issues/2044) | `:has([data-selected])` causes 500 ms recalcs | one attribute name, two meanings across components | open | calendar cells use `data-selected` for selection only, never for highlight |

## Known pitfalls

- **Time zones and "today".** Three libraries got today wrong from a default zone
  (ARK#2270 UTC default; Reka's `getLocalTimeZone()` regardless of the value's zone;
  BITS#2022 zoned headers). Today must come from one injected clock + one resolved zone.
- **Calendar systems are display, not data.** The emitted value keeps the caller's calendar
  and type; the grid shows the locale's calendar (RA). Mixing them shifts dates.
- **Week start is a weekday, not an index** (RK#2157, ZG#1208).
- **Disabled vs unavailable vs outside-visible** are three different things (RA#6108,
  RA#4614, ZG#3336, RA#8542).
- **Outside-month cells** are never interactive (RA#3257).
- **Focus rings** belong to one cell (RA#3975, RA#5246).
- **`role=application`** both fixes (RA#4637, RK#2438) and hurts (RK#2228): the root cause
  is focus on an inner button; avoid that instead.
- **Identity vs value**: a new object for the same day must not repage (RK#2960).
- **Engine bugs** before 1582 and in some calendar conversions (RA#6536, RA#3757).
- **SSR**: "today" differs between server and client around midnight and across zones;
  nothing time-dependent at module scope (RA#9786).

## Testing notes

- Node: the date-grid navigation module (pure) — every key in LTR/RTL, month ends (31 → 30,
  29 Feb), year paging on 29 Feb, min/max clamping, multi-month realignment,
  `pageBehavior`, each calendar system (gregory, buddhist `th-TH`, japanese era boundary,
  persian `fa-IR`, islamic-umalqura `ar-SA`, hebrew leap month), first day of week from
  `en-US`, `en-GB`, `ar-EG`, `fa-IR` and an override.
- Fake clock + fixed zone for "today" in every environment; a test at 23:30 in
  `Pacific/Auckland` vs `UTC`.
- Browser: focus moves to the cell for keyboard, not for pointer scroll; screen-reader-style
  `virtual` focus never selects (invariant 13); `virtual` click selects (invariant 12).
- Contract needs: select a date by its accessible name (the full date) with pointer, and by
  keys with keyboard (the driver computes the path: Shift+PageDown/PageDown to the month,
  arrows to the day, Enter); queries read ISO dates from `data-value`, not visible text.
- AT matrix (manual): NVDA + Chrome/Firefox (focus mode on cell focus — the RK#2438 check),
  JAWS + Chrome, VO macOS Safari, VO iOS (heading reached first, swipe through cells),
  TalkBack.

## Decisions

- **Shared date infrastructure** (`date-values` capability, specified in `add-calendar`,
  reused by every date component):
  - Value types: `CalendarDate`, `CalendarDateTime`, `ZonedDateTime` (and `Time` for Time
    Field) from `@internationalized/date`, re-exported by `@rind-ui/core`. A component emits
    values of the type and calendar system of its current value or `defaultValue`
    (gregorian `CalendarDate` when there is none), and selecting a date keeps an existing
    time of day (BITS#1358).
  - Display calendar system: the locale's resolved calendar (`-u-ca-` or the locale
    default); systems other than gregorian need a consumer-provided `createCalendar` (so the
    core bundles only `GregorianCalendar`); an unsupported or missing system falls back to
    gregorian with a development warning (RA#8017).
  - "Now": a new `DateClock` environment capability `{ now(): number; timeZone(): string }`
    (epoch ms; the viewer's resolved zone by default). Today = `now` in the first of: the
    `timeZone` prop, the value's zone (a `ZonedDateTime`), the clock's zone. Fake in tests.
    Never read at module scope (RA#9786).
  - Week: `firstDayOfWeek?: "sun" | "mon" | … | "sat"` (a weekday, not an index), default
    from the locale's CLDR week data; weekend from the locale (`isWeekend`).
  - Formatting: one cached `DateFormatter` per (locale, options) — the i18n module's cache
    pattern; the day number is the `day` part of `formatToParts` (RA#4135); the visible range
    text from `formatRange` parts.
  - Constraints: `minValue`/`maxValue` inclusive (compared as dates for date-only
    components), `isDateUnavailable(date)`; disabled ≠ unavailable.
  - Serialisation: ISO 8601 `toString()`.
- **Grid navigation is calendar-specific, not a `collection-grid` extension.** A calendar has
  no finite item set (it pages forever, cells are dates, duplicates exist across months,
  outside-month placeholders are not items); its moves are date arithmetic (±1 day, ±7, month
  with day clamping, year), not row/column index math; and APG's PageUp/PageDown/Shift
  semantics have no list equivalent. The pure module `calendar-navigation` (capability in
  `add-calendar`) takes `(focused, move, { visibleMonths, pageBehavior, min, max, locale,
  firstDayOfWeek, calendar })` and returns `{ focused, visibleStart }`; it is reused by Range
  Calendar and later Month/Year Picker. Grid List and Table remain the first users of a
  `collection-grid` extension. What we reuse from collections: the roving-tabindex rule
  (exactly one tab stop), `selectable` and `composite-roving` traits.
- **Keyboard**: APG table exactly — including Home/End = **start/end of week** (APG, Reka;
  RA and Zag use the month, a deliberate difference from them). Up/Down from a first/last
  week crosses months; arrows past min/max do nothing; PageUp/Down clamp the day; every move
  is clamped to min/max. Needs a grid orientation in `toLogicalKey` (request).
- **Parts**: `Root` (div, `role="group"`, named by `aria-label`/`aria-labelledby` of the
  consumer, else by the Heading), `Header` (div), `Heading` (h2 by default, the visible
  range text, `id` used by the Grid label), `PrevTrigger`/`NextTrigger` (buttons,
  `button-like-element`, `aria-disabled` when paging would leave min/max, so focus is never
  lost — RA moves focus away instead), `Grid` (table `role=grid`, `month` offset prop for
  multiple months; `aria-labelledby` = its month label), `GridHeader` (thead, `aria-hidden`),
  `HeaderCell` (th, weekday in `weekdayFormat`, full weekday in `abbr`), `GridBody`, `Row`,
  `Cell` (td `role=gridcell`, focusable). Outside-month cells render as placeholders.
- **Machine**: states `idle` / `focused` (the grid has DOM focus); context `focusedDate`
  (controllable `focusedValue`), `visibleStart`, value controllable (`value`/`defaultValue`/
  `onValueChange`, `null` | `DateValue`, or `DateValue[]` with `selectionMode="multiple"`).
  Events `NAVIGATE {move}`, `CELL.FOCUS {date, modality}`, `CELL.PRESS {date, modality}`,
  `SELECT_FOCUSED` (Enter/Space), `PAGE {direction}` (triggers), `GRID.FOCUS`/`GRID.BLUR`,
  `$sync:value`, `$sync:focusedValue`, prop steps for `minValue`/`maxValue`/`locale`
  (re-constrain focused). Effects: focus the cell on focused-date change while `focused`
  (keyboard/programmatic), announce the visible range on page while `idle`.
- **`data-*`**: Root/Grid `data-disabled`, `data-readonly`, `data-invalid`, `data-focus`,
  `data-focus-visible`; Cell `data-value` (ISO), `data-selected`, `data-today`,
  `data-weekend`, `data-outside-month`, `data-outside-visible-range`, `data-disabled`,
  `data-unavailable`, `data-invalid`, `data-focus`, `data-focus-visible`, `data-hover`,
  `data-pressed`; triggers `data-disabled`, `data-pressed`. `data-variant`/`data-size` pass
  through.
- **Contract**: actions `select(date)`, `focusDate(date)`, `nextPage()`, `previousPage()`,
  `press(key)`; queries `value()`, `focusedDate()`, `heading()`, `visibleMonths()`,
  `isSelected(date)`, `isUnavailable(date)`, `isDisabled(date)`, `today()`, announcements;
  traits `selectable`, `composite-roving`, plus calendar invariants.
- **Deliberately different**: focus on the gridcell, no `role="application"`, no inner
  button; `aria-current="date"` for today with the plain date as the name; Home/End by week
  (APG); unavailable focusable (RA, Zag) but triggers stay focusable at bounds
  (`aria-disabled`); `firstDayOfWeek` by name; no deselect on re-press in single mode (RA;
  Reka's default deselect surprised users of a required date) — a consumer deselects via a
  controlled value; no Calendar form participation (the Date Picker owns that).

## Open questions

- **NVDA on the cell-focus model**: does NVDA stay in focus mode when focus is on a focusable
  `td[role=gridcell]` inside `table[role=grid]`, with no `application` ancestor? APG's example
  suggests yes; RK#2438 was observed with the inner-button model. Device check before
  `done`; if it fails, the quirk entry `nvda-calendar-focus-mode` puts `role="application"`
  on the Root for NVDA platforms only (Windows), with RK#2228 recorded as the cost.
- **`aria-current="date"` speech**: verify JAWS/NVDA/VO/TalkBack speak "current date" on the
  focused cell; if one does not, `messages.cellLabel` gains the "Today" prefix for that AT
  through a quirk entry.
- Week numbers (ISO vs US, RK#2422), month/year dropdowns in the header (RA#4965, RA#5364
  comments) — the Month/Year Picker change.
</content>
</invoke>
