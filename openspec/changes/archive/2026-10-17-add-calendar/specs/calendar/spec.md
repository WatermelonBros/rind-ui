## Purpose

Defines rind-ui's Calendar: one or more month grids where the user moves a focused date with
the keyboard, pointer or touch and selects one or several dates, following the APG date grid,
with localised names, announcements and a driver contract. Introduced by `add-calendar`; Range
Calendar and the date pickers reuse its parts.

## ADDED Requirements

### Requirement: Anatomy

The Calendar SHALL consist of a `root` part (`div`), an optional `header` (`div`), a
`heading` (`h2` by default) showing the visible range, optional `prev-trigger` and
`next-trigger` parts (`<button>`), one `grid` part (`table`) per visible month with a `month`
offset (0 for the first), and inside each grid a `grid-header` (`thead`), `header-cell` (`th`),
`grid-body` (`tbody`), `row` (`tr`) and `cell` (`td`) parts. The grid parts SHALL be renderable
from a render function receiving the weeks of the month, or automatically. Every part SHALL
accept element substitution and forward its element's attributes. A trigger part MAY be
rendered more than once (for example a second next trigger after the grid for touch
screen-reader users); each instance behaves the same.

#### Scenario: Default month

- **WHEN** a Calendar with a heading, both triggers and one grid is rendered for October 2026
  with `firstDayOfWeek="sun"`
- **THEN** there is one element with role `grid`, five rows of seven cells for October,
  the heading reads "October 2026", and the triggers are named "Previous month" and
  "Next month"

### Requirement: Value And Selection

The Calendar SHALL have a controllable value (`value`, `defaultValue`, `onValueChange(value,
details)`): `DateValue | null` with `selectionMode="single"` (default), `DateValue[]` with
`selectionMode="multiple"`. Pressing a selectable cell or pressing Enter or Space on the
focused cell SHALL select it: in single mode the value becomes that date (pressing the selected
date again SHALL keep it selected); in multiple mode the date is added, or removed if it was
already selected, and the array stays sorted. `details.reason` SHALL be `CELL.PRESS` or
`KEY`, with `modality` and `cancel()`. Focus moving onto a cell SHALL never change the value.
A controlled value equal by date to the current one SHALL NOT change the focused date or the
visible range.

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

### Requirement: Focused Date And Visible Range

The focused date SHALL be controllable separately from the value (`focusedValue`,
`defaultFocusedValue`, `onFocusChange(date)`), constrained and initialised as
`calendar-navigation` defines. Exactly one enabled cell SHALL be in the tab sequence: the
focused date's cell (`tabIndex=0`), all other enabled cells `tabIndex=-1`, disabled cells not
focusable. When the grid has focus and the focused date changes from the keyboard or a prop,
DOM focus SHALL move to its cell and the cell SHALL be scrolled into view only for non-pointer
modalities. `onVisibleRangeChange({ start, end })` SHALL report every change of the visible
range.

#### Scenario: Controlled focus pages

- **WHEN** a parent sets `focusedValue` to 3 March 2027 while October 2026 is visible
- **THEN** March 2027 becomes visible and `onVisibleRangeChange` reports March 2027

#### Scenario: Focused date clamped

- **WHEN** the focused date is 5 October and `minValue` changes to 10 October
- **THEN** the focused date becomes 10 October

### Requirement: Reusable Pieces

`calendar.pieces.ts` SHALL export, for reuse by Range Calendar, Month Picker and Year Picker
without a copy: the focused-value controllable factory (`focusedValue`, `defaultFocusedValue`,
`onFocusChange`, constrained as in "Focused Date And Visible Range"), the `focusCell` and
`prepareAnnouncer` effects, and the action that announces the visible range on a page change.
Exporting them SHALL NOT change any Calendar behaviour.

#### Scenario: A second machine reuses the pieces

- **WHEN** a machine composes the exported focused-value controllable, `focusCell`,
  `prepareAnnouncer` and the announce-on-page action
- **THEN** a page change moves the focused value, announces the new range once under its own
  instance key, and moves DOM focus to the cell after the step commits, exactly as Calendar does

### Requirement: Multiple Visible Months

`visibleMonths` (default 1) SHALL set how many consecutive months are visible, each in its own
grid named by its own month; `pageBehavior` SHALL follow `calendar-navigation`. Days outside a
grid's month SHALL be rendered as placeholder cells (`data-outside-month`): not focusable, not
selectable, never selected or in a range, and labelled like any cell. `fixedWeeks` SHALL render
six rows in every grid.

#### Scenario: Two months

- **WHEN** `visibleMonths={2}` is set in October 2026
- **THEN** two grids are named "October 2026" and "November 2026", and 1 November appears as a
  placeholder in October's grid and as an enabled cell in November's

#### Scenario: Outside days never selected (react-spectrum#3257)

- **WHEN** the user clicks the placeholder of 1 November inside October's grid
- **THEN** nothing is selected

### Requirement: Keyboard Interaction

Within the grid the keyboard SHALL follow APG: ArrowRight/ArrowLeft next/previous day (mirrored
under `dir="rtl"`), ArrowDown/ArrowUp next/previous week, Home/End first/last day of the week,
PageDown/PageUp next/previous month, Shift+PageDown/Shift+PageUp next/previous year, all
through `calendar-navigation`; Enter and Space select the focused date when it is selectable.
Key repeats SHALL move repeatedly. Keys SHALL be ignored while an IME composes. Tab SHALL leave
the grid. The triggers SHALL activate with Enter and Space as buttons.

#### Scenario: Week edge (APG)

- **WHEN** Wednesday 14 October is focused with Sunday weeks and Home is pressed
- **THEN** Sunday 11 October is focused

#### Scenario: Next year

- **WHEN** 14 October 2026 is focused and Shift+PageDown is pressed
- **THEN** October 2027 is visible and 14 October 2027 is focused

#### Scenario: Arrow crosses the month

- **WHEN** 31 October is focused in a one-month calendar and ArrowRight is pressed
- **THEN** November is visible and 1 November is focused

#### Scenario: Arabic arrows

- **WHEN** the calendar has `dir="rtl"`, 14 October is focused and ArrowLeft is pressed
- **THEN** 15 October is focused

### Requirement: Pointer And Touch

A cell SHALL select on press release (`press-interactions`), so a press moved off the cell or a
touch scroll does not select. A mouse or pen hovering an enabled cell SHALL set `data-hover`;
touch SHALL never set it. A pointer press SHALL focus the pressed cell without showing a focus
ring. A press of a trigger SHALL page without moving focus off the trigger.

#### Scenario: Touch scroll does not select

- **WHEN** a touch starts on a cell and turns into a scroll of the page
- **THEN** no date is selected

### Requirement: Unavailable And Disabled Dates

A cell SHALL be disabled when its date is before `minValue`, after `maxValue`, outside its
grid's month, or the Calendar is disabled: not focusable, not selectable, `aria-disabled=
"true"`, `data-disabled`. A cell SHALL be unavailable when `isDateUnavailable(date)` is true:
focusable, not selectable, `aria-disabled="true"`, `data-unavailable`, not `data-disabled`.
Pressing or pressing Enter on an unavailable cell SHALL do nothing. When the value is
unavailable or out of range, the Calendar SHALL be invalid (`data-invalid` on the root and on
that cell, `aria-invalid="true"` on that cell).

#### Scenario: Enter on an unavailable date (react-spectrum#5692)

- **WHEN** today is unavailable, focused, and the user presses Enter
- **THEN** the value is unchanged and no other date is selected

#### Scenario: Unavailable value

- **WHEN** a controlled value of 17 October is passed and 17 October is unavailable
- **THEN** the root carries `data-invalid` and the cell of 17 October has `aria-invalid="true"`
  and `aria-selected="true"`

### Requirement: Disabled And Read-Only

With `disabled`, no part SHALL be focusable or respond to input, the grid SHALL carry
`aria-disabled="true"`, and the selection SHALL still be exposed (`aria-selected`,
`data-selected`). With `readOnly`, navigation and focus SHALL work, selection SHALL NOT change,
and the grid SHALL carry `aria-readonly="true"`.

#### Scenario: Disabled keeps the selection visible (react-spectrum#8542)

- **WHEN** a Calendar with 14 October selected is disabled
- **THEN** the cell of 14 October has `aria-selected="true"` and `data-selected`

#### Scenario: Read-only navigation

- **WHEN** a read-only Calendar's cell is focused and the user presses ArrowRight then Enter
- **THEN** the next day is focused and the value is unchanged

### Requirement: Grid Semantics

The root SHALL have `role="group"`, named by the consumer's `aria-label` or `aria-labelledby`
and otherwise by the heading. Each grid SHALL have `role="grid"`, be named by its month (via
`aria-labelledby` to the heading in a one-month calendar, otherwise by its month name from
`messages`), carry `aria-multiselectable="true"` in multiple mode, and contain rows of
`gridcell`s. The grid header row SHALL be `aria-hidden` (cell names include the weekday); no
other part SHALL be hidden. The cell itself SHALL be the focusable element; no part of the
Calendar SHALL have `role="application"` or `aria-roledescription` by default.

#### Scenario: Focus lands on the gridcell (react-spectrum#4637, reka-ui#2438)

- **WHEN** the user tabs into the grid
- **THEN** the focused element has role `gridcell` and no ancestor has role `application`

#### Scenario: Header focusables stay exposed (bits-ui#902)

- **WHEN** a consumer renders a focusable control inside the `header` part
- **THEN** it has no `aria-hidden` ancestor

### Requirement: Cell Names And States

Each cell's accessible name SHALL be `messages.cellLabel` applied to its date (default: the full
localised date — weekday, day, month, year, and the era when the calendar shows eras, e.g.
"Wednesday, October 14, 2026"). Its states SHALL be attributes, not words in the name:
`aria-selected="true"` for selected dates and `aria-selected="false"` for every other
selectable date, `aria-disabled="true"` for disabled and unavailable dates, and
`aria-current="date"` on today's cell. The visible text SHALL be the day number.

#### Scenario: Name and states of today, selected

- **WHEN** today, 14 October 2026, is selected and focused in `en-US`
- **THEN** the focused element's name is "Wednesday, October 14, 2026", with
  `aria-selected="true"` and `aria-current="date"`

#### Scenario: Explicit unselected state (collections invariant 9)

- **WHEN** a Calendar with a value is rendered
- **THEN** every selectable cell has `aria-selected` set to "true" or "false"

### Requirement: Triggers

The previous and next triggers SHALL page as `calendar-navigation` defines and be named by
`messages.previous` and `messages.next` (default "Previous month" / "Next month"). A trigger
whose paging would leave the constraints SHALL carry `aria-disabled="true"` and
`data-disabled`, stay focusable, and do nothing when pressed, so focus is never lost. A
press on a trigger with a pointer, by touch or with a key leaves focus on the trigger (the grid
is left, so the new range is announced); an assistive technology's click (virtual modality),
which does not move DOM focus, SHALL keep the grid focused and move focus to the cell of the
paged date. Enter and Space on a cell are the grid's keys (select the focused date) and SHALL
NOT also act through the cell's press.

#### Scenario: Screen reader click on a trigger

- **WHEN** the grid has focus and a screen reader activates the next trigger with a bare
  `click`
- **THEN** the next month is shown and DOM focus is on the cell of the paged date

#### Scenario: Enter selects once in multiple mode

- **WHEN** a multiple-selection Calendar's focused cell is not selected and the user presses
  Enter
- **THEN** the date is selected (it is not toggled back by a second activation)

#### Scenario: Trigger at the maximum keeps focus

- **WHEN** the user presses the next trigger until the month of `maxValue` is visible
- **THEN** the next trigger has `aria-disabled="true"` and still has focus

### Requirement: Announcements

When the visible range changes while focus is not inside the grid (a trigger press, a
controlled `focusedValue`), the Calendar SHALL announce the visible range text (for example
"November 2026") through the injected Announcer, politely, keyed per calendar so quick paging
announces only the last range. When the grid has focus, paging SHALL NOT announce (the focused
cell's name carries the month). The Calendar SHALL prepare the Announcer on mount, and SHALL
render no live region of its own.

#### Scenario: Trigger paging is announced (react-spectrum#3559)

- **WHEN** the Calendar is inside a modal dialog and the user presses the next trigger twice
  quickly
- **THEN** exactly one announcement "December 2026" is made, and the Announcer's regions were
  in the document before it

#### Scenario: Keyboard paging is not announced twice

- **WHEN** a cell is focused and PageDown is pressed
- **THEN** no announcement is made and focus is on the cell of the next month

### Requirement: Messages

The Calendar SHALL take a typed `messages` object with English defaults: `previous`
("Previous month"), `next` ("Next month"), `cellLabel({ date, formatted })` (default
`formatted`), `monthLabel({ formatted })` (default `formatted`), `visibleRange({ formatted })`
(default `formatted`). All dates inside messages SHALL be formatted by the Calendar in its
locale and calendar system.

#### Scenario: German names

- **WHEN** the locale is `de-DE` and `messages={{ next: "Nächster Monat" }}`
- **THEN** the next trigger is named "Nächster Monat" and the cell of 14 October 2026 is
  named "Mittwoch, 14. Oktober 2026"

### Requirement: Data Attributes

Every part SHALL carry `data-scope="calendar"`, its `data-part` and `data-instance`. Root and
grids SHALL carry `data-disabled`, `data-readonly`, `data-invalid` and `data-focus` /
`data-focus-visible` while focus is in a grid. Each cell SHALL carry `data-value` (ISO date),
and when they apply `data-selected`, `data-today`, `data-weekend`, `data-outside-month`,
`data-disabled`, `data-unavailable`, `data-invalid`, `data-focus`, `data-focus-visible`,
`data-hover` and `data-pressed`. Triggers SHALL carry `data-disabled` and `data-pressed`.
`data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: One focus ring (react-spectrum#3975, react-spectrum#5246)

- **WHEN** the user pages back and forth with the keyboard ten times across months
- **THEN** after every step exactly one cell carries `data-focus-visible`, and it is the
  focused date's cell

### Requirement: Contract

The Calendar SHALL ship a contract with scope `calendar`, located by role `group` and exact
accessible name, with anatomy as above and:

- actions: `select(date)` (pointer: click the cell named by the date; keyboard: move focus with
  Shift+PageUp/Down, PageUp/Down and arrows to the date, then Enter; virtual: bare click),
  `focusDate(date)` (keyboard moves only; pointer declared none with the reason "focus without
  selecting is keyboard only"), `nextPage()` / `previousPage()` (pointer: the trigger; keyboard:
  PageDown/PageUp in the grid), `press(key)`;
- queries: `value()` (ISO dates of cells with `aria-selected="true"`), `focusedDate()`,
  `heading()`, `visibleMonths()`, `isSelected(date)`, `isUnavailable(date)`,
  `isDisabled(date)`, `today()` (the cell with `aria-current="date"`), `isInvalid()`,
  `announcements()`;
- states `idle`, `focused`, observed through `data-focus` on the root;
- events: `CELL.PRESS` and `SELECT_FOCUSED` map to `select`, `NAVIGATE` to `press`, `PAGE` to
  `nextPage`/`previousPage`, `CELL.FOCUS` and `GRID.BLUR` `skip` ("covered by every action"),
  prop steps `$sync:value`, `$sync:focusedValue`, `$props:minValue`, `$props:disabled`;
- traits: `selectable` (cells are the items; the oracle's selection from the value),
  `composite-roving`, plus the calendar invariants.

#### Scenario: Same test in both environments

- **WHEN** `getCalendar(screen, { name: "Departure" }).select("2026-11-03")` runs in jsdom and
  with a Playwright `page`, starting from October 2026
- **THEN** both resolve with `value()` equal to `["2026-11-03"]`

### Requirement: Calendar Invariants

The contract SHALL ship invariants checked after every model step: exactly one cell has
`tabIndex=0` and it is the focused date's cell; the focused date is within the constraints and
inside the visible range; at most one cell carries `data-focus`; the heading text equals the
formatted visible range; `aria-current="date"` is on exactly the cell of today when it is
visible and on no other; no placeholder cell is focusable, selected or `aria-selected="true"`;
every `data-value` parses as an ISO date in its grid's month or the adjacent months; and the
number of announcements equals the number of visible-range changes made while focus was not
in a grid.

#### Scenario: Broken wrapper adds a button inside cells

- **WHEN** a consumer wrapper renders a focusable `button` inside each cell
- **THEN** the first keyboard step fails, naming the roving tab-stop invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Calendar in `calendar.css` with `--rind-calendar-*` tokens
read with semantic fallbacks, the root in family `panel` and the cells in family `collection
item`: cells at least 24×24 CSS px, a focus ring on `data-focus-visible`, selected cells
distinguishable without colour (an edge in the palette `border` role), today with a border,
unavailable with a strike-through, placeholders muted, a `data-tone="danger"` invalid state,
and every state visible under forced colors (`Highlight`/`HighlightText` for selected,
`GrayText` for disabled and placeholders).

#### Scenario: Forced colors

- **WHEN** a Calendar with a selected date, today, an unavailable date and a focused date is
  rendered under forced colors
- **THEN** each of the four states is visible and distinguishable
</content>
</invoke>
