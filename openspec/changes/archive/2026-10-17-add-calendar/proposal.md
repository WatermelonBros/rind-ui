## Why

A calendar grid is the base of every date component (Range Calendar, Date Picker, Date Range
Picker, Month/Year Picker) and the first place rind-ui needs dates at all: calendar systems,
time zones, "today", the locale's week and date formatting. The bug history (40 entries in
the research note) shows the same failures across libraries: today on the wrong day from a
default time zone (ark#2270), week start as a locale-relative index (reka-ui#2157), screen
readers reading the whole month or walking the DOM (react-spectrum#4637, reka-ui#2438),
several cells with a focus ring (react-spectrum#3975), unavailable dates that select their
neighbour (react-spectrum#5692). Specifying the date infrastructure once, here, keeps the
seven components after it from repeating them.

Research: [calendar](../../../docs/research/calendar.md) ·
[collections](../../../docs/research/collections.md) (grid navigation deferred to Calendar) ·
[accessibility](../../../docs/research/accessibility.md) §4.2, §6, §7, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4, causes C, D, E, I, K, L ·
[native-platform](../../../docs/research/native-platform.md) §8

Depends on: `add-foundations` (archived: runtime, controllables, contracts, drivers,
`testMachine`), `add-a11y-foundations` (`keyboard-interactions`, `press-interactions` incl.
hover, `interaction-modality`, `announcer`, `i18n-messages`, `element-ids`, `a11y-quirks`,
`platform-and-preferences`), `add-collections` (`collection-testing`: `selectable` and
`composite-roving` traits only), `add-button` (`button-like-element` for the triggers),
`add-theme-system`.

## What Changes

- **Shared date infrastructure** (`date-values`): `@internationalized/date` value types
  re-exported from `@rind-ui/core`; values keep the caller's type, calendar system and time of
  day; display calendar from the locale with an injected `createCalendar`; a new `DateClock`
  environment capability for "now" and the time zone; "today" resolved from it; the week's
  first day as a weekday name (locale default); weekend from the locale; cached formatting;
  inclusive min/max; ISO serialisation.
- **Date-grid navigation** (`calendar-navigation`): a pure module for moving a focused date by
  day, week, week edges, month and year with APG semantics, clamping to min/max, realigning the
  visible months, paging by the visible duration or one month. Not a `collection-grid`
  extension (see design §2).
- A public **Calendar** component: `Root`, `Header`, `Heading`, `PrevTrigger`, `NextTrigger`,
  `Grid` (one per visible month), `GridHeader`, `HeaderCell`, `GridBody`, `Row`, `Cell`; single
  or multiple selection; controllable `value` and `focusedValue` separately; `visibleMonths`,
  `pageBehavior`, `fixedWeeks`, `firstDayOfWeek`, `weekdayFormat`, `minValue`/`maxValue`,
  `isDateUnavailable`, `disabled`, `readOnly`, `invalid`.
- APG grid semantics with focus on the `gridcell` itself (no inner button, no
  `role="application"`), full localised date names, `aria-selected` true/false,
  `aria-disabled` for unavailable, `aria-current="date"` for today, the visible month announced
  through the Announcer on paging.
- Contract and driver (`getCalendar`), calendar invariants, model-based tests, theme
  stylesheet, stories, docs page.

## Capabilities

### New Capabilities

- `date-values`: date value types, calendar systems, the date clock and today, week data,
  formatting, constraints and serialisation shared by every date and time component.
- `calendar-navigation`: keyboard and paging moves over dates for calendar grids (Calendar,
  Range Calendar, later Month/Year Picker).
- `calendar`: the Calendar component — anatomy, selection, focus and visible range, keyboard,
  pointer and touch, ARIA, announcements, data attributes, contract, theme.

### Modified Capabilities

- `keyboard-interactions` (archived): `"grid"` orientation, logical keys `PREV_ROW`/`NEXT_ROW`, RTL rules for the grid.
- `a11y-quirks` (archived): reserved entry `nvda-calendar-focus-mode` (ADDED).

Other extensions needed in other changes are listed in design.md under "Requests to other
changes".

## Non-goals

- Date Picker (popover, input, trigger) and form participation of a standalone Calendar: the
  Date Picker change owns `name`/hidden input.
- Month and year views or dropdowns in the header (Month/Year Picker change), week numbers
  (reka-ui#2422 shows ISO vs US rules matter; deferred), a week or day view (react-spectrum#4652).
- Deselecting by pressing the selected date in single mode (Reka's default).
- Chinese/Dangi calendars (`@internationalized/date` does not implement them).
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `i18n/date.ts` (`date-values`), `env` `DateClock` capability and its
  `domEnvironment()` implementation, `components/calendar/` (`calendar.navigation.ts`,
  machine, connect, contract, messages).
- `packages/react/src/calendar/`, `@rind-ui/testing` (`getCalendar`, calendar invariants),
  `@rind-ui/theme/calendar.css`, stories, docs.
- Runtime dependency `@internationalized/date` (already allowed by decision 0002) becomes a
  dependency of `@rind-ui/core`; only `GregorianCalendar` is bundled by default.
- Reado: not used.
</content>
</invoke>
