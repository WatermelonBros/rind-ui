## Why

Billing months, birth years, report periods and fiscal-year ranges are chosen without ever
showing a day, and picking a far-away date in a Calendar takes dozens of paging presses.
Reka UI ships four components for this (Month, Month Range, Year, Year Range pickers); Ark and
Zag add month and year *views* to their Date Picker; React Aria and Bits UI only offer selects in
the Calendar header. Their bug history (18 entries in the research note) is short but
specific: the emitted date silently loses its day and time (reka-ui#2587, #2588), a hard-coded
four-column grid breaks Up/Down navigation when the grid changes (reka-ui#2781), min/max
compared as dates make one of two years unselectable (zag#2153), years outside the page are
disabled (zag#3336), Enter and click disagree about an unavailable month (zag#2501), keyboard
navigation crashes in month and year views (zag#2397), a controlled focus change steals DOM
focus (react-spectrum#9427), and a minimum in the next year leaves no focusable year
(bits-ui#1873).

Research: [month-year-picker](../../../docs/research/month-year-picker.md) ·
[calendar](../../../docs/research/calendar.md) ·
[range-calendar](../../../docs/research/range-calendar.md) ·
[accessibility](../../../docs/research/accessibility.md) §4.2, §6, §7, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4, causes C, D, E, I, K ·
[native-platform](../../../docs/research/native-platform.md) §8

Depends on: `add-calendar` (`date-values`, `calendar-navigation` for its rules, the Calendar's
machine pieces: `calendar.pieces.ts`), `add-range-calendar` (`range-calendar.range.ts`: `makeRange`,
`availableBounds`, `crossesUnavailable`; the anchor, commit, cancel and leave semantics),
`add-foundations`, `add-a11y-foundations` (`keyboard-interactions`, `press-interactions`,
`interaction-modality`, `announcer`, `i18n-messages`, `element-ids`, `hidden-content`),
`add-collections` (`selectable` and `composite-roving` traits only), `add-button`
(`button-like-element`), `add-overlay-infrastructure` (`layer-stack` logical-inside query, for the
range leave rule), `add-theme-system`.

## What Changes

- **Period navigation** (`period-navigation`): a pure module that moves a focused month or year by
  one period, by a row (the same column in the adjacent row), to the first or last period of the
  page, and by a page (a year of months, a block of years), across pages, clamped to min/max,
  for any calendar system (13-month years, eras).
- A public **Month Picker** and **Year Picker** — a grid of the months of a year and a grid of
  `yearsPerPage` years, each with `Root`, `Header`, `Heading`, `PrevTrigger`, `NextTrigger`,
  `Grid`, `Body`, `Row`, `Cell`; `selectionMode: "single" | "range"` (the four Reka families); one
  machine and connect parameterised by `unit`.
- Unit-granular values and constraints: the emitted value is the current value with only its
  month (year) changed, keeping type, calendar and time of day; `minValue`/`maxValue` compared at
  the unit; `isMonthUnavailable` / `isYearUnavailable`; `columns` configurable and used by both
  rendering and navigation.
- Calendar-style semantics: focus on the gridcell (no inner button, no `role="application"`),
  `aria-selected` true/false, `aria-current="date"` for the current period, announcements through
  the Announcer when the page changes while the grid is not focused, a controlled focus change that
  never steals DOM focus.
- Range mode reuses Range Calendar's anchor, preview, commit on the second press, Escape,
  `commitOnBlur` and paging-keeps-anchor rules.
- Contract and drivers (`getMonthPicker`, `getYearPicker`), period invariants, model-based tests,
  theme stylesheets, stories, docs.

## Capabilities

### New Capabilities

- `period-navigation`: keyboard and paging moves over months and years for the pickers.
- `month-picker`: the Month Picker component — anatomy, value and selection, range mode, ARIA,
  announcements, data attributes, contract, theme.
- `year-picker`: the Year Picker component — what differs from the Month Picker (the page of
  years, eras, `yearsPerPage`), contract, theme.

### Modified Capabilities

None. Extensions needed in other changes are listed in design.md under "Requests to other
changes".

## Non-goals

- A Calendar `view` / view-trigger heading (Ark): drill-down is a documented composition over the
  Calendar's controllable `focusedValue`; a first-class part is a request.
- Month and year `<select>` dropdowns in the Calendar header (React Aria, Bits UI): a recipe.
- Multiple selection (Reka's `multiple`), drag selection in range mode, quarter or week-of-year
  units, fiscal-year offsets, decade or century pages.
- Form participation (hidden inputs, names): like Calendar, the date inputs own it; a picker with
  a text field belongs to the Date Picker change.
- Chinese/Dangi calendars (`@internationalized/date` does not implement them); framework adapters
  other than React; fx.

## Impact

- `packages/core/src/components/period-navigation/` (pure), `components/month-picker/` and
  `components/year-picker/` (shared machine and connect in `components/period-picker/`, contracts,
  messages), reusing `components/calendar/calendar.pieces.ts` and
  `components/range-calendar/range-calendar.range.ts`.
- `packages/react/src/month-picker/`, `year-picker/`, `@rind-ui/testing` (`getMonthPicker`,
  `getYearPicker`), `@rind-ui/theme/month-picker.css`, `year-picker.css`, stories, docs.
- No new dependency. Reado: not used.
