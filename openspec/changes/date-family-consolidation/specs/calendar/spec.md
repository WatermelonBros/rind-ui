## MODIFIED Requirements

### Requirement: Anatomy

The Calendar SHALL consist of a `root` part (`div`), an optional `header` (`div`), a
`heading` (`h2` by default) showing the visible range, optional `prev-trigger` and
`next-trigger` parts (`<button>`), one `grid` part (`table`) per visible month with a `month`
offset (0 for the first), and inside each grid a `grid-header` (`thead`), `header-cell` (`th`),
`grid-body` (`tbody`), `row` (`tr`) and `cell` (`td`) parts. In the month and year views
(Month And Year Views) there SHALL be one grid per page, with no `grid-header` row. The grid
parts SHALL be renderable from a render function receiving the weeks of the month (the rows of
periods in the month and year views), or automatically. Every part SHALL accept element
substitution and forward its element's attributes. In range mode the root SHALL also render a
visually hidden `prompt` part (`span`) that describes the focused cell (Range Prompts And
Announcements). A trigger part MAY be rendered more than
once (for example a second next trigger after the grid for touch screen-reader users); each
instance behaves the same.

#### Scenario: Default month

- **WHEN** a Calendar with a heading, both triggers and one grid is rendered for October 2026
  with `firstDayOfWeek="sun"`
- **THEN** there is one element with role `grid`, five rows of seven cells for October,
  the heading reads "October 2026", and the triggers are named "Previous month" and
  "Next month"

#### Scenario: Month view

- **WHEN** a Calendar with `view="months"` is rendered for 2026 in `en-US`
- **THEN** there is one element with role `grid` with three rows of four cells named "January
  2026" to "December 2026", the cells read "Jan" to "Dec", the heading reads "2026" and the
  triggers are named "Previous year" and "Next year"

### Requirement: Value And Selection

The Calendar SHALL have a controllable value (`value`, `defaultValue`, `onValueChange(value,
details)`): `DateValue | null` with `selectionMode="single"` (default), `DateValue[]` with
`selectionMode="multiple"`, `{ start: DateValue; end: DateValue } | null` with
`selectionMode="range"` (Range Selection). Pressing a selectable cell or pressing Enter or Space
on the focused cell SHALL select it: in single mode the value becomes that date (pressing the
selected date again SHALL keep it selected); in multiple mode the date is added, or removed if
it was already selected, and the array stays sorted; in range mode the press is a step of the
range selection. `details.reason` SHALL be `CELL.PRESS` or `KEY`, with `modality` and
`cancel()`. Focus moving onto a cell SHALL never change the value. A controlled value equal by
date to the current one SHALL NOT change the focused date or the visible range.

#### Scenario: Click selects

- **WHEN** the user clicks the cell of 20 October 2026
- **THEN** `onValueChange` is called once with `CalendarDate(2026, 10, 20)` and that cell has
  `aria-selected="true"`

#### Scenario: Focus does not select (cause C)

- **WHEN** a screen reader moves DOM focus onto the cell of 21 October without a key event
- **THEN** the value is unchanged and 21 October becomes the focused date

#### Scenario: Multiple toggle

- **WHEN** `selectionMode="multiple"` and the user presses 3, 10 and then 3 October again
- **THEN** the value is `[2026-10-10]`

#### Scenario: Same day, new object (reka-ui#2960)

- **WHEN** the parent pages to November and then passes a new `CalendarDate` equal to the
  selected October date as `value`
- **THEN** November stays visible

### Requirement: Data Attributes

Every part SHALL carry `data-scope="calendar"`, its `data-part` and `data-instance`. Root and
grids SHALL carry `data-disabled`, `data-readonly`, `data-invalid`, `data-view` (`days`,
`months` or `years`) and `data-focus` / `data-focus-visible` while focus is in a grid, and in
range mode `data-anchored` while an anchor is set and `data-dragging` during a drag selection.
Each cell SHALL carry `data-value` (ISO date; the first day of the period in the month and year
views), and when they apply `data-selected`, `data-today`, `data-weekend`, `data-outside-month`,
`data-disabled`, `data-unavailable`, `data-invalid`, `data-focus`, `data-focus-visible`,
`data-hover` and `data-pressed`, and in range mode `data-in-range` (inside the committed range,
its ends included), `data-range-start`, `data-range-end`, `data-anchor` (only while anchored),
`data-preview`, `data-preview-start` and `data-preview-end`. Placeholder cells SHALL carry none of
the range attributes; a lone anchor SHALL carry `data-anchor` and not `data-range-end`. Triggers
SHALL carry `data-disabled` and `data-pressed`. `data-variant` and `data-size` SHALL pass
through untouched.

#### Scenario: One focus ring (react-spectrum#3975, react-spectrum#5246)

- **WHEN** the user pages back and forth with the keyboard ten times across months
- **THEN** after every step exactly one cell carries `data-focus-visible`, and it is the
  focused date's cell

#### Scenario: Two months, range shown once (reka-ui#2730)

- **WHEN** October and November are visible and the value is 28 October – 3 November
- **THEN** the placeholders of 1–3 November in October's grid carry no range attribute, and the
  in-month cells of 28 October to 3 November carry `data-in-range`

#### Scenario: Lone anchor (react-spectrum#5456)

- **WHEN** only an anchor on 10 October is set
- **THEN** that cell has `data-anchor` and neither `data-range-start` nor `data-range-end`

### Requirement: Contract

The Calendar SHALL ship a contract with scope `calendar`, located by role `group` and exact
accessible name, with anatomy as above and:

- actions: `select(date)` (pointer: click the cell named by the date; keyboard: move focus with
  Shift+PageUp/Down, PageUp/Down and arrows to the date, then Enter; virtual: bare click),
  `focusDate(date)` (keyboard moves only; pointer declared none with the reason "focus without
  selecting is keyboard only"), `nextPage()` / `previousPage()` (pointer: the trigger; keyboard:
  PageDown/PageUp in the grid), `press(key)`, and in range mode `selectRange(start, end)`
  (pointer: two clicks; keyboard: navigate and Enter twice; touch: two taps; virtual: two bare
  clicks), `startRange(date)`, `cancel()` (Escape), and from phase 1b `dragRange(start, end)`
  (pointer and pen; keyboard declared as `selectRange`);
- queries: `value()` (ISO dates of cells with `aria-selected="true"`), `range()` (the visible
  `data-range-start` and `data-range-end` cells, or null), `anchor()`, `preview()`,
  `isAnchored()`, `focusedDate()`, `heading()`, `visibleMonths()`, `isSelected(date)`,
  `isUnavailable(date)`, `isDisabled(date)`, `today()` (the cell with `aria-current="date"`),
  `isInvalid()`, `announcements()`;
- states `idle` and `focused`, observed through `data-focus` on the root; the range in
  progress is not a machine state (it exists in both) and is observed through `data-anchored`
  and the `isAnchored()` query (from phase 1b, a drag through `data-dragging`);
- events: `CELL.PRESS` and `SELECT_FOCUSED` map to `select` (`selectRange` / `startRange` in
  range mode), `NAVIGATE` to `press`, `PAGE` to `nextPage`/`previousPage`, `CANCEL` to `cancel`,
  `CELL.FOCUS`, `GRID.BLUR`, `CELL.HOVER` and `LEAVE` `skip` ("covered by every action"), prop
  steps `$sync:value`, `$sync:focusedValue`, `$sync:anchor` (set, then clear, without a commit),
  `$props:minValue`, `$props:disabled`;
- traits: `selectable` (cells are the items; the oracle's selection from the value, multiple in
  range mode from the committed range), `composite-roving`, plus the calendar invariants and, in
  range mode, the range invariants.

From phase 2 the same contract SHALL serve the month and year views, with the period (`"2027-03"`, `"2031"`)
in place of the date in `select`, `focusDate` and `selectRange`.

#### Scenario: Same test in both environments

- **WHEN** `getCalendar(screen, { name: "Departure" }).select("2026-11-03")` runs in jsdom and
  with a Playwright `page`, starting from October 2026
- **THEN** both resolve with `value()` equal to `["2026-11-03"]`

#### Scenario: Driver selects a range

- **WHEN** `getCalendar(screen, { name: "Stay" }).selectRange("2026-10-10", "2026-10-14")` runs
  with each modality on a range calendar
- **THEN** `range()` is `{ start: "2026-10-10", end: "2026-10-14" }` each time

### Requirement: Calendar Invariants

The contract SHALL ship invariants checked after every model step: exactly one cell has
`tabIndex=0` and it is the focused date's cell; the focused date is within the constraints and
inside the visible range; at most one cell carries `data-focus`; the heading text equals the
formatted visible range; `aria-current="date"` is on exactly the cell of today (the current
period in the month and year views) when it is visible and on no other; no placeholder cell is
focusable, selected or `aria-selected="true"`; every `data-value` parses as an ISO date in its
grid's month or the adjacent months (the page in the month and year views); no cell is
`role="button"` or contains a focusable descendant; and the number of announcements equals the
number of visible-range changes made while focus was not in a grid.

#### Scenario: Broken wrapper adds a button inside cells

- **WHEN** a consumer wrapper renders a focusable `button` inside each cell
- **THEN** the first keyboard step fails, naming the roving tab-stop invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Calendar in `calendar.css` with `--rind-calendar-*` tokens
read with semantic fallbacks, the root in family `panel` and the cells in family `collection
item`: cells at least 24×24 CSS px, a focus ring on `data-focus-visible`, selected cells
distinguishable without colour (an edge in the palette `border` role), today with a border,
unavailable with a strike-through, placeholders muted, a `data-tone="danger"` invalid state, and
every state visible under forced colors (`Highlight`/`HighlightText` for selected, `GrayText`
for disabled and placeholders). In range mode it SHALL draw the range as one continuous band
across a week row (middle days, start and end caps), the anchor, and a preview distinguishable
from the committed range without colour (a dashed edge); under forced colors the committed range
SHALL use `Highlight` and the preview a dashed outline. Month and year cells SHALL be wide
enough for a short month name at 320 px in four columns.

#### Scenario: Forced colors

- **WHEN** a Calendar with a selected date, today, an unavailable date and a focused date is
  rendered under forced colors
- **THEN** each of the four states is visible and distinguishable

#### Scenario: Preview vs range in forced colors

- **WHEN** a committed range and a preview are shown together under forced colors
- **THEN** the committed days use `Highlight` and the preview a dashed outline, and both are
  distinguishable

## ADDED Requirements

### Requirement: Range Selection

With `selectionMode="range"` the value SHALL be `{ start, end } | null`, with `start ≤ end`,
each end of the same type as the single value (`date-values`: type, calendar and time of day
kept for each end). Selecting SHALL take two steps: the first selection of a selectable date
(a press, or Enter or Space on the focused cell) sets the **anchor**
(`onAnchorChange(date)`, value unchanged); the second commits `{ start, end }` from the anchor
and the second date in date order, calls `onValueChange` once, and clears the anchor
(`onAnchorChange(null)`). Two selections of the same date SHALL commit a one-day range. After a
commit, the next selection SHALL always start a new anchor, including on the previous start or
end date. A controlled value set by the parent (including `null`) SHALL clear the anchor and be
shown immediately. The anchor SHALL be controllable (`anchor`, `defaultAnchor`,
`onAnchorChange(date | null)`): a controlled `anchor` change SHALL set or clear the anchor
without committing a value and without calling `onAnchorChange`, and a later change of `value`
clears a controlled anchor; a parent that sets `anchor` to the start of a half-entered range
thereby lets the next selection complete it. The grids SHALL carry
`aria-multiselectable="true"`.

#### Scenario: Backward range

- **WHEN** the user presses 20 October, then 10 October
- **THEN** `onValueChange` is called once with `{ start: 2026-10-10, end: 2026-10-20 }`

#### Scenario: Keyboard range

- **WHEN** the user focuses 10 October, presses Enter, moves with ArrowRight four times and
  presses Space
- **THEN** `onValueChange` is called once with 10–14 October

#### Scenario: Previous start starts a new range (zag#2388)

- **WHEN** the value is 10–20 October and the user presses 10 October
- **THEN** 10 October is the anchor and the value is unchanged until a second press

#### Scenario: Programmatic clear (bits-ui#1068, reka-ui#1611)

- **WHEN** the parent sets `value={null}` while 10–20 October is shown
- **THEN** no cell is selected and no anchor is set

#### Scenario: Resuming a half-typed range

- **WHEN** the parent sets `anchor` to 10 October while the value is `null`, and the user
  presses 14 October
- **THEN** `onValueChange` is called once with 10–14 October and no value was committed when
  the anchor was set

#### Scenario: Same keyboard as Calendar

- **WHEN** a cell of a range Calendar is focused and Shift+PageDown, Home and ArrowRight are
  pressed
- **THEN** the focused date moves exactly as in a single-mode Calendar with the same props

#### Scenario: Controlled anchor cleared by the parent

- **WHEN** a controlled `anchor` of 10 October is changed to `null`
- **THEN** no cell has `data-anchor`, the preview is gone and `onValueChange` was not called

#### Scenario: One change per commit (reka-ui#2396)

- **WHEN** the user selects a start and an end
- **THEN** `onValueChange` was called once and `onAnchorChange` twice (date, then null)

### Requirement: Range Preview

While an anchor is set, the preview SHALL be the dates from the anchor to the hovered date
(mouse or pen over an enabled cell) or, otherwise, the focused date, in date order, so the
arrow keys move the preview. Preview cells SHALL carry `data-preview` (and
`data-preview-start` / `data-preview-end` on its earlier and later dates) and SHALL NOT change
`aria-selected`, which stays the committed value. Hover SHALL never page or move the visible
range. The preview SHALL be cleared on commit, on cancel and when the pointer leaves the grids
with no focused cell inside them.

#### Scenario: Preview is not selection (react-spectrum#3285)

- **WHEN** the anchor is 10 October and the mouse hovers 14 October
- **THEN** 10–14 October carry `data-preview`, and only cells of the committed value have
  `aria-selected="true"`

#### Scenario: Arrows move the preview

- **WHEN** the anchor is 10 October with focus on it and ArrowDown is pressed
- **THEN** 10–17 October carry `data-preview`

#### Scenario: Backward hover (zag#2660)

- **WHEN** the anchor is 27 June and the mouse hovers 11 June
- **THEN** 11 June carries `data-preview-start` and 27 June `data-preview-end`

#### Scenario: Hover over a placeholder does not page (zag#3084)

- **WHEN** the mouse hovers the placeholder of 1 November inside October's grid while anchored
- **THEN** the visible month stays October and the preview is unchanged

### Requirement: Range Cancel And Leave

Escape while anchored SHALL clear the anchor and the preview, keep the value, and be consumed;
Escape with no anchor SHALL NOT be consumed (it reaches an enclosing layer). Leaving the
Calendar while anchored — focus moving outside it, or a press outside it — SHALL apply
`commitOnBlur`: `"reset"` (default) clears the anchor and keeps the value, `"select"` commits
the preview, `"clear"` clears the anchor and sets the value to `null`. "Inside" SHALL be the
root's subtree, including its non-cell parts (header controls, whitespace), and any layer whose
logical parent is inside it; containment SHALL be computed from the event's composed path so it
holds inside shadow roots. Paging with the triggers, the keyboard or a controlled
`focusedValue` SHALL keep the anchor.

#### Scenario: Escape cancels the anchor

- **WHEN** the anchor is 12 October and Escape is pressed
- **THEN** no anchor or preview remains, the value is unchanged and the key was consumed

#### Scenario: Clicking outside cancels (react-spectrum#5709, react-spectrum#8850, react-spectrum#8287)

- **WHEN** the value is 1–5 October, the user sets the anchor on 12 October and clicks outside
- **THEN** the value is still 1–5 October and no anchor is set

#### Scenario: Header select is inside (react-spectrum#3738)

- **WHEN** a month `<select>` (or a Select whose popup is portalled) in the header is used while
  anchored
- **THEN** the anchor is kept

#### Scenario: Shadow root (react-spectrum#10330)

- **WHEN** the Calendar is rendered inside a shadow root and the user clicks 8 October and then
  17 October
- **THEN** the value is 8–17 October

#### Scenario: Paging keeps the anchor on touch (react-spectrum#8889)

- **WHEN** on a touch device the user taps 28 October, taps the next trigger and taps
  3 November
- **THEN** the value is 28 October – 3 November

#### Scenario: Escape bubbles without an anchor

- **WHEN** a range Calendar without an anchor is inside a dialog and Escape is pressed
- **THEN** the dialog closes

### Requirement: Drag Selection

In range mode a primary mouse or pen press on a selectable date SHALL set the anchor on press
start; moving the pressed pointer over other cells SHALL update the preview; releasing over
another selectable date SHALL commit; releasing over the anchor SHALL keep the anchor (so a
click starts a range). A touch press SHALL start a drag only after `dragDelay` (default 200 ms)
without movement, and while dragging the page SHALL NOT scroll; a touch that scrolls before the
delay SHALL be cancelled and change nothing; a tap SHALL behave as a press. A release with no
pointer movement over another cell (the calendar moved under a still pointer) SHALL behave as a
click. An assistive-technology activation SHALL act as exactly one press.

#### Scenario: Mouse drag

- **WHEN** the user presses on 10 October, moves over 11–14 October and releases on 14 October
- **THEN** the value is 10–14 October and `onValueChange` was called once

#### Scenario: Touch scroll does not select (react-spectrum#5975)

- **WHEN** a touch starts on a cell of a scrollable multi-month calendar and scrolls the list
- **THEN** no anchor is set and the value is unchanged

#### Scenario: Layout shift is not a drag (react-spectrum#4007)

- **WHEN** setting the anchor repositions the calendar so a different cell is under the still
  pointer at release
- **THEN** only the anchor is set

#### Scenario: Screen-reader press

- **WHEN** a screen reader activates 10 October and then 14 October with bare clicks
- **THEN** the value is 10–14 October

### Requirement: Range Length

`minRangeLength` and `maxRangeLength` (in days, ends included; in periods in the month and year
views) SHALL bound a range: while anchored, every date that would make a range shorter than
`minRangeLength` (other than the anchor itself when `minRangeLength` is 1) or longer than
`maxRangeLength` SHALL be disabled (`data-disabled`, not selectable) and the end prompt SHALL say
so. A committed value outside the bounds SHALL make the Calendar invalid.

#### Scenario: At most a week

- **WHEN** `maxRangeLength={7}` and the anchor is 10 October
- **THEN** 4 to 16 October can be pressed, 3 and 17 October are disabled until the anchor is
  cleared

#### Scenario: At least two nights

- **WHEN** `minRangeLength={3}` and the anchor is 10 October
- **THEN** 9, 10 and 11 October are disabled and 12 October can be pressed

### Requirement: Unavailable Dates In Ranges

`isDateUnavailable(date, { anchor })` SHALL receive the current anchor (`null` when none). With
`allowsNonContiguousRanges` false (default), while anchored, every date beyond the nearest
unavailable date before and after the anchor SHALL be disabled (`data-disabled`, not
selectable), so a range can never be committed across an unavailable date, and the prompt SHALL
say so; unavailable dates SHALL never be an end. With `allowsNonContiguousRanges` true, a range
MAY contain unavailable dates. A committed value that contains an unavailable date while
non-contiguous ranges are not allowed, or whose start or end is unavailable or out of range,
SHALL make the Calendar invalid (`data-invalid`, and `aria-invalid="true"` on its cells).

#### Scenario: Contiguous by default (react-spectrum#8854)

- **WHEN** 15 October is unavailable and the anchor is 12 October
- **THEN** 16 October and later are disabled until the anchor is cleared

#### Scenario: Range crossing an unavailable date is invalid (react-spectrum#5302)

- **WHEN** a controlled value of 12–18 October is passed while 15 October is unavailable
- **THEN** the root carries `data-invalid`

#### Scenario: Anchor-aware availability (react-spectrum#3311)

- **WHEN** `isDateUnavailable` returns true for dates more than 7 days after the anchor
- **THEN** with the anchor on 1 October, 9 October cannot be pressed

### Requirement: Range Prompts And Announcements

Every selectable cell inside the committed range SHALL have `aria-selected="true"`, every other
selectable cell `aria-selected="false"`. In range mode the focused cell SHALL be described
(through a visually hidden node referenced by `aria-describedby`) by `messages.startPrompt` with
no anchor (default "Press Enter to start a range") and by `messages.endPrompt({ anchor })` while
anchored (default "Press Enter to end the range starting {anchor}"); cell names SHALL stay the
plain date. The Calendar SHALL announce, politely and keyed per instance,
`messages.anchorSet({ anchor })` (default "Range starts {anchor}") when an anchor is set and
`messages.rangeSelected({ start, end })` (default "Selected {start} to {end}") on commit.

#### Scenario: Prompt follows the phase

- **WHEN** the user focuses 10 October, presses Enter, then focuses 14 October
- **THEN** the description of 14 October's cell is "Press Enter to end the range starting
  Saturday, October 10, 2026", and the announcement was "Range starts Saturday, October 10,
  2026"

#### Scenario: Names stay short (react-spectrum#6043)

- **WHEN** the value is 12–16 March 2024
- **THEN** the name of the 12 March cell is "Tuesday, March 12, 2024"

### Requirement: Reusable Range Helpers

The pure range module SHALL export `makeRange(a, b)`, `availableBounds(anchor, isUnavailable,
visibleMonths)`, `lengthBounds(anchor, minRangeLength, maxRangeLength)` and
`crossesUnavailable(range, isUnavailable)` as public helpers, generic over comparable period
starts: they SHALL work on `CalendarDate`s and take the period (`day`, `month` or `year`) as an
argument, so the month and year views pass first-of-period dates and receive bounds and
crossings in the same unit. `availableBounds` SHALL return the nearest unavailable period start
before and after the anchor (`null` when none within its search limit). The inside watch effect
and the prompt messages SHALL be exported as reusable pieces (Date Field's range popover reuses
them).

#### Scenario: Bounds around an anchor

- **WHEN** 15 October is unavailable and `availableBounds` is called for the anchor 12 October
  at day granularity
- **THEN** the upper bound is 14 October and the lower bound is `null`

#### Scenario: Month granularity

- **WHEN** `crossesUnavailable` is called for the range September–December 2026 at month
  granularity with November unavailable
- **THEN** it returns true, and for September–October it returns false

### Requirement: Range Invariants

The contract SHALL ship invariants checked after every model step in range mode: the value is
`null` or has `start ≤ end`; `aria-selected="true"` holds exactly on selectable cells inside the
committed range; `data-preview` is present only while anchored; `data-anchor` is on exactly one
cell while anchored and on none otherwise; `onValueChange` was called exactly once per commit;
paging never cleared an anchor.

#### Scenario: Broken variant selects the preview

- **WHEN** a broken variant sets `aria-selected="true"` on preview cells
- **THEN** the first hover step after an anchor fails, naming the selection invariant

### Requirement: Month And Year Views

`view` SHALL be `"days"` (default), `"months"` (a grid of the months of one year) or `"years"`
(a grid of `yearsPerPage` years, default 12), in rows of `columns` cells (default 4), paged as
`period-navigation` defines. `view` SHALL be controllable (`view`, `defaultView`,
`onViewChange(view, details)`, reasons `heading`, `select`, `escape-key`, `api`), and `minView` /
`maxView` (default `"days"` / `"years"`) SHALL bound it. Every requirement of the Calendar SHALL apply to the month and year
views with the period as the unit, except where this requirement differs. The value SHALL be
period-granular: two dates in the same period are the same value and `onValueChange` SHALL NOT
be called when the chosen period equals the value's. Choosing a month SHALL emit the current
value with only its month changed and its day clamped to the month's length; choosing a year
SHALL emit it with only its year changed (29 February clamped to 28 February); both SHALL keep
type, calendar, time of day and zone; with no value they SHALL emit the first day of the period
as the type of `defaultValue`, else `placeholderValue`, else a gregorian `CalendarDate`. Keys:
ArrowLeft / ArrowRight the previous / next period (mirrored in RTL), ArrowUp / ArrowDown the same
column of the adjacent row, Home / End the first / last period of the page, PageUp / PageDown the
same position on the adjacent page, Enter and Space select; there SHALL be no drag selection.
`isMonthUnavailable(month)` / `isYearUnavailable(year)` SHALL decide availability for the period
(never derived from its days); disabled (outside `minValue`/`maxValue` at the period, or the
Calendar disabled) and unavailable SHALL stay distinct. Cells SHALL be named by
`messages.cellLabel` for the period (default "October 2026", or the localised year with its era
when the calendar shows eras), show the month in `monthFormat` (`"short"` default, `"long"`,
`"narrow"`, `"numeric"`) or the year's `year` part in the display calendar, and carry
`aria-current="date"` on the current period. The heading SHALL show the page's year, or the
page's first and last year as a range ("2016 – 2027"); the triggers SHALL page by one year or
one block of years and be named by the view's messages (default "Previous year" / "Next year",
"Previous years" / "Next years"). Range mode SHALL work in both views with the range module at
the period.

#### Scenario: Day and time kept (reka-ui#2587, reka-ui#2588)

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user selects March in
  the month view, then 2031 in the year view
- **THEN** the emitted values are `CalendarDateTime(2026, 3, 14, 9, 30)` and
  `CalendarDateTime(2031, 3, 14, 9, 30)`

#### Scenario: Day clamped

- **WHEN** the value is 31 March 2026 and the user selects February
- **THEN** the emitted value is 28 February 2026

#### Scenario: Vertical moves use the column count (reka-ui#2781)

- **WHEN** `columns={3}` and ArrowDown is pressed on March
- **THEN** June is focused

#### Scenario: Enter and click agree (zag#2501)

- **WHEN** a month is available and the user presses it with the mouse, then with Enter
- **THEN** both select it; and for an unavailable month both do nothing

#### Scenario: Both years selectable (zag#2153)

- **WHEN** `minValue` is 15 December 2025 and `maxValue` is 20 February 2026 in the year view
- **THEN** the cells of 2025 and 2026 can be selected and the other cells are disabled

#### Scenario: Years outside the first page are reachable (zag#3336)

- **WHEN** no `minValue` or `maxValue` is set and the user presses the next trigger in the year
  view
- **THEN** the next block of years is shown with no disabled cell

#### Scenario: Paging keeps the position (zag#1906)

- **WHEN** 2021 (the sixth year of its page) is focused and PageDown is pressed in the year view
- **THEN** 2033 is focused and the heading reads "2028 – 2039"

#### Scenario: Range across pages (zag#2556)

- **WHEN** in the month view the value is October 2026 – April 2027 and 2027 is shown
- **THEN** January to April carry `data-in-range`, April carries `data-range-end`, and the months
  before and after carry neither; paging back to 2026 shows October as `data-range-start` and
  November and December as `data-in-range`

#### Scenario: Controlled focus does not steal focus (react-spectrum#9427)

- **WHEN** a native `<select>` in the header changes `focusedValue` to another year while the
  select has focus
- **THEN** the page shows that year and focus is still on the select

#### Scenario: Hebrew leap year

- **WHEN** the locale is `he-IL-u-ca-hebrew` with `createCalendar` and a leap year is shown in the
  month view
- **THEN** 13 cells are rendered

#### Scenario: Buddhist years

- **WHEN** the locale is `th-TH` with `createCalendar` in the year view
- **THEN** the cell for 2026 reads "2569" and its `data-value` is "2026-01-01"



#### Scenario: Default page (months view)

- **WHEN** a Calendar in the month view for 2026 in `en-US` is rendered with a heading and both triggers
- **THEN** there is one element with role `grid` with three rows of four cells named "January 2026"
  to "December 2026", the cells' text is "Jan" to "Dec", the heading reads "2026", and the
  triggers are named "Previous year" and "Next year"

#### Scenario: Custom column count (months view)

- **WHEN** `columns={3}` is set
- **THEN** the grid has four rows of three cells

#### Scenario: Day and time kept (reka-ui#2587) (months view)

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user selects March
- **THEN** the emitted value is `CalendarDateTime(2026, 3, 14, 9, 30)`

#### Scenario: No value emits the first day (months view)

- **WHEN** no value is set and the user selects June 2026
- **THEN** the emitted value is the gregorian `CalendarDate` 2026-06-01

#### Scenario: Same month is no change (months view)

- **WHEN** the value is 14 October 2026 and the user presses October
- **THEN** `onValueChange` is not called and the month stays selected

#### Scenario: Controlled clear (months view)

- **WHEN** the parent sets `value={null}` while a month is selected
- **THEN** no cell is selected

#### Scenario: New object for the same month (reka-ui#2960) (months view)

- **WHEN** the parent passes a new `CalendarDate` object for the same month while the user has paged
  to another year
- **THEN** the page does not change

#### Scenario: Page follows the value (months view)

- **WHEN** the value is set by the parent to March 2031
- **THEN** 2031 is shown and March has `tabindex="0"`

#### Scenario: Arrow across the year (APG) (months view)

- **WHEN** December 2026 is focused and ArrowRight is pressed
- **THEN** January 2027 is focused and shown

#### Scenario: RTL (months view)

- **WHEN** `dir="rtl"` and ArrowLeft is pressed on October
- **THEN** November is focused; ArrowDown still moves to the next row

#### Scenario: Keyboard works in every mode (zag#2397) (months view)

- **WHEN** each key above is pressed in single mode and in range mode
- **THEN** none throws and each lands as specified

#### Scenario: Virtual focus does not select (months view)

- **WHEN** a screen reader moves its cursor onto October without activating it
- **THEN** the value is unchanged

#### Scenario: Bare click selects (months view)

- **WHEN** a bare `click` with no pointer events is dispatched on the cell for October
- **THEN** October is selected once

#### Scenario: Max month selectable (months view)

- **WHEN** `maxValue` is 5 October 2026
- **THEN** October 2026 can be selected and November 2026 is disabled

#### Scenario: Unavailable is not disabled (months view)

- **WHEN** `isMonthUnavailable` is true for August
- **THEN** the August cell has `data-unavailable`, not `data-disabled`, is reachable with the arrows and
  pressing it changes nothing

#### Scenario: Disabled keeps the selection (react-spectrum#8542) (months view)

- **WHEN** a disabled month view has a value
- **THEN** its month still has `aria-selected="true"`

#### Scenario: Read-only pages (months view)

- **WHEN** a read-only picker's next trigger is pressed and a month is pressed
- **THEN** the next year is shown and the value is unchanged

#### Scenario: Leaving cancels (months view)

- **WHEN** the value is January–March, the user sets the anchor on June and clicks outside
- **THEN** the value is still January–March and no anchor is set

#### Scenario: Paging keeps the anchor (react-spectrum#8889) (months view)

- **WHEN** the user presses November 2026, presses the next trigger and presses February 2027
- **THEN** the value is November 2026 – February 2027

#### Scenario: Hover never pages (zag#3084) (months view)

- **WHEN** an anchor is set and the pointer moves over cells
- **THEN** the shown year does not change

#### Scenario: Preview is not selection (months view)

- **WHEN** an anchor is set on March and October is hovered
- **THEN** April to October carry `data-preview` and `aria-selected` stays `"false"` for them

#### Scenario: Focus lands on the gridcell (months view)

- **WHEN** the user tabs into the grid
- **THEN** the focused element has role `gridcell` and no ancestor has role `application`

#### Scenario: Header controls exposed (bits-ui#902) (months view)

- **WHEN** a native `<select>` is rendered inside the `header`
- **THEN** it has no `aria-hidden` ancestor

#### Scenario: Name and state of the current, selected month (months view)

- **WHEN** October 2026 is current and selected in `en-US`
- **THEN** the cell's name is "October 2026", with `aria-selected="true"` and `aria-current="date"`

#### Scenario: Locale names (months view)

- **WHEN** the locale is `de-DE`
- **THEN** the cell of October 2026 reads "Okt" and is named "Oktober 2026"

#### Scenario: Explicit unselected state (months view)

- **WHEN** a picker with a value is rendered
- **THEN** every selectable cell has `aria-selected` set to "true" or "false"

#### Scenario: Trigger at the maximum keeps focus (months view)

- **WHEN** the next trigger is pressed until the year of `maxValue` is shown
- **THEN** it has `aria-disabled="true"` and still has focus

#### Scenario: Trigger paging announced once (months view)

- **WHEN** inside a modal dialog the user presses the next trigger twice quickly
- **THEN** exactly one announcement "2028" is made

#### Scenario: Keyboard paging is silent (months view)

- **WHEN** a cell is focused and PageDown is pressed
- **THEN** no announcement is made

#### Scenario: Range commit announced (months view)

- **WHEN** the user commits March 2026 – June 2026
- **THEN** one announcement "Selected March 2026 to June 2026" is made

#### Scenario: Italian names (months view)

- **WHEN** `messages={{ next: "Anno successivo" }}` is set
- **THEN** the next trigger is named "Anno successivo"

#### Scenario: One focus ring (months view)

- **WHEN** the user pages with the keyboard across ten years
- **THEN** after every step exactly one cell carries `data-focus-visible`

#### Scenario: Anchor is not a range end (react-spectrum#5456) (months view)

- **WHEN** an anchor is set and no range exists
- **THEN** the anchor cell has `data-anchor` and no `data-selection-end`

#### Scenario: Month, day and time kept (reka-ui#2588) (years view)

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user selects 2031
- **THEN** the emitted value is `CalendarDateTime(2031, 10, 14, 9, 30)`

#### Scenario: Leap day (years view)

- **WHEN** the value is 29 February 2028 and the user selects 2029
- **THEN** the emitted value is 28 February 2029

#### Scenario: Default page (years view)

- **WHEN** a Calendar in the year view is rendered with the focused year 2026 in `en-US`
- **THEN** the heading reads "2016 – 2027", the grid has three rows of four cells for 2016 to 2027 and
  the cell of 2026 has `tabindex="0"`

#### Scenario: Ten years per page (years view)

- **WHEN** `yearsPerPage={10}` and `columns={5}` are set
- **THEN** the page is 2020–2029 in two rows of five

#### Scenario: Page change announced (years view)

- **WHEN** the next trigger is pressed with focus on it
- **THEN** one announcement "2028 – 2039" is made

#### Scenario: BC years (years view)

- **WHEN** a gregorian page shows 3 BC to 8 BC
- **THEN** the cells are named with their era ("3 BC") and the value emitted for the cell of 3 BC is a
  gregorian BC date

#### Scenario: Backward range (months view)

- **WHEN** the user presses November 2026 and then March 2026
- **THEN** `onValueChange` is called once with March 2026 – November 2026

#### Scenario: Same test in both environments (months view)

- **WHEN** `getCalendar(screen, { name: "Billing month" }).select("2027-03")` runs in jsdom and with a
  Playwright `page`, starting from 2026
- **THEN** both resolve with `value()` equal to `["2027-03-01"]`

#### Scenario: Broken wrapper adds a button inside cells (months view)

- **WHEN** a consumer wrapper renders a focusable `button` inside each cell
- **THEN** the first keyboard step fails, naming the roving tab-stop invariant

#### Scenario: Forced colors (months view)

- **WHEN** a Calendar in the month view with a selected range, a current month and an unavailable month is rendered
  under forced colors
- **THEN** the range (`Highlight`), the current month (border), the unavailable month (strike-through,
  `GrayText`) and the focused cell (outline) are all distinguishable

#### Scenario: Forced colors (years view)

- **WHEN** a Calendar in the year view with a selected year and the current year is rendered under forced colors
- **THEN** both are distinguishable and the focused cell has an outline

### Requirement: View Drill-Down

When `maxView` is above the current view, the heading SHALL be a button (named by the heading
text and `messages.viewUp`, default "Choose month" / "Choose year") that moves up one view: days →
months → years, keeping the focused period. Selecting a period in a view above `minView` SHALL
move down one view, focusing the first day (or month) of the chosen period without changing the
value unless that view is the Calendar's `minView`; selecting in `minView` SHALL select the value.
Escape in a view above `minView` SHALL move down one view before any outer layer handles it. A
view change SHALL move focus to the new view's tab stop and be announced politely with the new
heading. With `view` fixed (controlled and never changed), the heading SHALL be plain text.

#### Scenario: Day to year and back

- **WHEN** the days view shows October 2026 and the user presses the heading twice, picks 2031,
  then March
- **THEN** the views go days → months → years → months → days, the days view shows March 2031,
  and the value changed only when a day was picked

#### Scenario: Month picker

- **WHEN** a Calendar has `minView="months"` and `defaultView="months"` and the user picks March
- **THEN** the value's month is March and the view stays months

#### Scenario: Escape goes down

- **WHEN** the years view is open inside a picker and Escape is pressed
- **THEN** the Calendar shows the months view and the picker stays open
