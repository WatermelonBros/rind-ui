## Purpose

Defines rind-ui's Month Picker: a grid of the months of one year where the user moves a focused
month with the keyboard, pointer or touch and selects one month or a range of months, with
localised names, announcements and a driver contract. Built on `date-values` (`add-calendar`),
`period-navigation` and, for ranges, the semantics of Range Calendar. Year Picker
(`year-picker`) shares everything below except the unit. Introduced by `add-month-year-picker`.

## ADDED Requirements

### Requirement: Anatomy

The Month Picker SHALL consist of a `root` part (`div`), an optional `header` (`div`), a `heading`
(`h2` by default) showing the page's year, optional `prev-trigger` and `next-trigger` parts
(`<button>`), one `grid` part (`table`), and inside it a `body` (`tbody`), `row` (`tr`) and `cell`
(`td`) parts; there is no header row. The grid parts SHALL be renderable from a render function
receiving the rows of months (as laid out by `columns`), or automatically. Every part SHALL accept
element substitution and forward its element's attributes. A trigger part MAY be rendered more than
once. Every part SHALL carry `data-scope="month-picker"`, its `data-part` and `data-instance`.

#### Scenario: Default page

- **WHEN** a Month Picker for 2026 in `en-US` is rendered with a heading and both triggers
- **THEN** there is one element with role `grid` with three rows of four cells named "January 2026"
  to "December 2026", the cells' text is "Jan" to "Dec", the heading reads "2026", and the
  triggers are named "Previous year" and "Next year"

#### Scenario: Custom column count

- **WHEN** `columns={3}` is set
- **THEN** the grid has four rows of three cells

### Requirement: Value And Selection

The value SHALL be controllable (`value`, `defaultValue`, `onValueChange(value, details)`) of type
`DateValue | null` in single mode. The value SHALL be unit-granular: two dates in the same month and
year are the same value, and `onValueChange` SHALL NOT be called when the chosen month equals the
value's month. Choosing a month SHALL emit the current value with only its month changed and its
day clamped to the target month's length, keeping its type, calendar system, time of day and time
zone (`date-values`); with no value it SHALL emit day 1 of the month as the type of `defaultValue`,
else `placeholderValue`, else a gregorian `CalendarDate`. Pressing the selected month again SHALL
NOT deselect it. A value set by the parent, including `null`, SHALL be shown immediately and move
the page to its year.

#### Scenario: Day and time kept (reka-ui#2587)

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user selects March
- **THEN** the emitted value is `CalendarDateTime(2026, 3, 14, 9, 30)`

#### Scenario: Day clamped

- **WHEN** the value is 31 March 2026 and the user selects February
- **THEN** the emitted value is 28 February 2026

#### Scenario: No value emits the first day

- **WHEN** no value is set and the user selects June 2026
- **THEN** the emitted value is the gregorian `CalendarDate` 2026-06-01

#### Scenario: Same month is no change

- **WHEN** the value is 14 October 2026 and the user presses October
- **THEN** `onValueChange` is not called and the month stays selected

#### Scenario: Controlled clear

- **WHEN** the parent sets `value={null}` while a month is selected
- **THEN** no cell is selected

#### Scenario: New object for the same month (reka-ui#2960)

- **WHEN** the parent passes a new `CalendarDate` object for the same month while the user has paged
  to another year
- **THEN** the page does not change

### Requirement: Focused Period And Page

The focused month SHALL be controllable separately from the value (`focusedValue`,
`defaultFocusedValue`, `onFocusedValueChange`), initially per `period-navigation`. The visible page
(the year) SHALL always contain the focused month. A change of `focusedValue` made by the parent
while the grid does not have DOM focus SHALL change the page and the focused cell but SHALL NOT move
DOM focus. Selecting a month SHALL focus it. Hovering SHALL never change the page.

#### Scenario: Controlled focus does not steal focus (react-spectrum#9427)

- **WHEN** a native `<select>` in the header changes `focusedValue` to another year while the select has
  focus
- **THEN** the page shows that year and focus is still on the select

#### Scenario: Page follows the value

- **WHEN** the value is set by the parent to March 2031
- **THEN** 2031 is shown and March has `tabindex="0"`

### Requirement: Keyboard Interaction

With focus on a cell: ArrowLeft / ArrowRight SHALL move to the previous / next month (mirrored in
RTL, crossing to the adjacent year), ArrowUp / ArrowDown to the same column of the previous / next
row (crossing years), Home / End to the first / last month of the page, PageUp / PageDown to the same
month of the previous / next year, Enter and Space SHALL select the focused month. Each move SHALL
follow `period-navigation` and move DOM focus to the new cell (and to the new page's cell). Key
repeat SHALL work. Keys SHALL be ignored during IME composition and with Ctrl, Alt or Meta held.
The keys SHALL work identically in single and range mode, with and without a value.

#### Scenario: Arrow across the year (APG)

- **WHEN** December 2026 is focused and ArrowRight is pressed
- **THEN** January 2027 is focused and shown

#### Scenario: Vertical moves use the column count (reka-ui#2781)

- **WHEN** `columns={3}` and ArrowDown is pressed on March
- **THEN** June is focused

#### Scenario: RTL

- **WHEN** `dir="rtl"` and ArrowLeft is pressed on October
- **THEN** November is focused; ArrowDown still moves to the next row

#### Scenario: Keyboard works in every mode (zag#2397)

- **WHEN** each key above is pressed in single mode and in range mode
- **THEN** none throws and each lands as specified

#### Scenario: Enter and click agree (zag#2501)

- **WHEN** a month is available and the user presses it with the mouse, then with Enter
- **THEN** both select it; and for an unavailable month both do nothing

### Requirement: Pointer And Touch

A press on an available cell SHALL select it and focus it, acting on release (a touch scroll over the
grid cancels and selects nothing). A hover SHALL set `data-hover` for mouse and pen only. Focusing
a cell without pressing it (screen-reader virtual cursor) SHALL NOT select it; an assistive-technology
click arrives as one press.

#### Scenario: Virtual focus does not select

- **WHEN** a screen reader moves its cursor onto October without activating it
- **THEN** the value is unchanged

#### Scenario: Bare click selects

- **WHEN** a bare `click` with no pointer events is dispatched on the cell for October
- **THEN** October is selected once

### Requirement: Constraints, Unavailable And Disabled Months

`minValue` and `maxValue` SHALL be inclusive at the month (`period-navigation`).
`isMonthUnavailable(month)` SHALL be called with the month's first day and mark months that cannot be
chosen but remain in the grid; availability SHALL be decided by the consumer for the month and never
derived from the availability of its days. Disabled (outside min/max, or the component disabled) and
unavailable SHALL be distinct states: disabled cells are not focusable, unavailable cells stay
focusable with `aria-disabled="true"`, and pressing either does nothing (no neighbouring month is
selected). A month on the page is never disabled merely for not being the current page's year.

#### Scenario: Max month selectable

- **WHEN** `maxValue` is 5 October 2026
- **THEN** October 2026 can be selected and November 2026 is disabled

#### Scenario: Unavailable is not disabled

- **WHEN** `isMonthUnavailable` is true for August
- **THEN** the August cell has `data-unavailable`, not `data-disabled`, is reachable with the arrows and
  pressing it changes nothing

### Requirement: Disabled And Read-Only

With `disabled`, no cell SHALL be focusable or selectable, the triggers SHALL be disabled, and the
selection SHALL stay visible (`aria-selected` and `data-selected` unchanged). With `readOnly`, cells
SHALL be focusable and navigable and paging SHALL work, but selecting SHALL change nothing and
`aria-readonly="true"` SHALL be set on the grid.

#### Scenario: Disabled keeps the selection (react-spectrum#8542)

- **WHEN** a disabled Month Picker has a value
- **THEN** its month still has `aria-selected="true"`

#### Scenario: Read-only pages

- **WHEN** a read-only picker's next trigger is pressed and a month is pressed
- **THEN** the next year is shown and the value is unchanged

### Requirement: Range Selection

With `selectionMode="range"` the value SHALL be `{ start, end } | null` (unit-granular, `start ≤
end`, each end emitted as in Value And Selection) and selection SHALL follow Range Calendar: the first
press or Enter sets the anchor (`onAnchorChange(date)`, value unchanged), the second commits the
two months in order (`onValueChange` once, `onAnchorChange(null)`), the next press after a commit
starts a new anchor, a preview from the anchor to the hovered or focused month carries `data-preview*`
without `aria-selected`, Escape cancels an anchor (consumed; without an anchor it bubbles), leaving the
picker while anchored applies `commitOnBlur` (`"reset"` default) with the Range Calendar's inside rule
(composed path, logical-parent layers), and paging (triggers, keyboard, controlled focus) keeps the
anchor. The range logic (`makeRange`, bounds around unavailable months, validity of a committed range
crossing an unavailable month unless `allowsNonContiguousRanges`) SHALL be that of Range Calendar
applied to month starts. Range attributes SHALL be computed by comparing month starts, for any page.
There SHALL be no drag selection.

#### Scenario: Backward range

- **WHEN** the user presses November 2026 and then March 2026
- **THEN** `onValueChange` is called once with March 2026 – November 2026

#### Scenario: Range across pages (zag#2556)

- **WHEN** the value is October 2026 – April 2027 and 2027 is shown
- **THEN** January to April carry `data-in-range`, April carries `data-selection-end`, and months before
  and after carry neither; paging back to 2026 shows October as `data-selection-start` and November and
  December as `data-in-range`

#### Scenario: Leaving cancels

- **WHEN** the value is January–March, the user sets the anchor on June and clicks outside
- **THEN** the value is still January–March and no anchor is set

#### Scenario: Paging keeps the anchor (react-spectrum#8889)

- **WHEN** the user presses November 2026, presses the next trigger and presses February 2027
- **THEN** the value is November 2026 – February 2027

#### Scenario: Hover never pages (zag#3084)

- **WHEN** an anchor is set and the pointer moves over cells
- **THEN** the shown year does not change

#### Scenario: Preview is not selection

- **WHEN** an anchor is set on March and October is hovered
- **THEN** April to October carry `data-preview` and `aria-selected` stays `"false"` for them

### Requirement: Grid Semantics

The root SHALL have `role="group"`, named by the consumer's `aria-label` or `aria-labelledby` and
otherwise by the heading. The grid SHALL have `role="grid"` named by the heading (`aria-labelledby`),
with `aria-multiselectable="true"` in range mode, `aria-readonly` and `aria-disabled` as applicable,
and contain rows of `gridcell`s. No part SHALL be `aria-hidden` (the Header may contain focusable
controls). The cell itself SHALL be the focusable element; no part SHALL have `role="application"` or
`aria-roledescription` by default. Exactly one cell SHALL be in the tab sequence (roving tabindex).

#### Scenario: Focus lands on the gridcell

- **WHEN** the user tabs into the grid
- **THEN** the focused element has role `gridcell` and no ancestor has role `application`

#### Scenario: Header controls exposed (bits-ui#902)

- **WHEN** a native `<select>` is rendered inside the `header`
- **THEN** it has no `aria-hidden` ancestor

### Requirement: Cell Names And States

Each cell's accessible name SHALL be `messages.cellLabel` applied to its month (default: the full
localised month and year, with the era when the calendar shows eras, e.g. "October 2026"); its visible
text SHALL be the month in `monthFormat` (`"short"` default, `"long"`, `"narrow"`, `"numeric"`), from
`Intl` in the display calendar. States SHALL be attributes: `aria-selected="true"` for selected
months and `"false"` for every other selectable month, `aria-disabled="true"` for disabled and
unavailable months, `aria-current="date"` on the current month (from the date clock and zone as
`date-values` defines today). Non-gregorian calendars SHALL show their own month names and counts.

#### Scenario: Name and state of the current, selected month

- **WHEN** October 2026 is current and selected in `en-US`
- **THEN** the cell's name is "October 2026", with `aria-selected="true"` and `aria-current="date"`

#### Scenario: Locale names

- **WHEN** the locale is `de-DE`
- **THEN** the cell of October 2026 reads "Okt" and is named "Oktober 2026"

#### Scenario: Hebrew leap year

- **WHEN** the locale is `he-IL-u-ca-hebrew` with `createCalendar` and a leap year is shown
- **THEN** 13 cells are rendered

#### Scenario: Explicit unselected state

- **WHEN** a picker with a value is rendered
- **THEN** every selectable cell has `aria-selected` set to "true" or "false"

### Requirement: Triggers

The previous and next triggers SHALL page by one year (`period-navigation` `previous-page` /
`next-page` of the focused month) and be named by `messages.previous` / `messages.next` (default
"Previous year" / "Next year"). A trigger whose paging would leave the constraints SHALL carry
`aria-disabled="true"` and `data-disabled`, stay focusable and do nothing when pressed.

#### Scenario: Trigger at the maximum keeps focus

- **WHEN** the next trigger is pressed until the year of `maxValue` is shown
- **THEN** it has `aria-disabled="true"` and still has focus

### Requirement: Announcements

When the page changes while focus is not inside the grid (a trigger press, a controlled
`focusedValue`), the picker SHALL announce the heading ("2027") through the injected Announcer,
politely and keyed per instance so quick paging announces only the last page. When the grid has focus,
paging SHALL NOT announce. In range mode it SHALL announce the anchor ("Range starts {month}") and the
commit ("Selected {start} to {end}"). It SHALL prepare the Announcer on mount and render no live region
of its own. The focused cell in range mode SHALL be described (`aria-describedby`, a hidden node) by the
phase prompt: "Press Enter to start a range" / "Press Enter to end the range starting {month}".

#### Scenario: Trigger paging announced once

- **WHEN** inside a modal dialog the user presses the next trigger twice quickly
- **THEN** exactly one announcement "2028" is made

#### Scenario: Keyboard paging is silent

- **WHEN** a cell is focused and PageDown is pressed
- **THEN** no announcement is made

#### Scenario: Range commit announced

- **WHEN** the user commits March 2026 – June 2026
- **THEN** one announcement "Selected March 2026 to June 2026" is made

### Requirement: Messages

The picker SHALL take a typed `messages` object with English defaults: `previous` ("Previous year"),
`next` ("Next year"), `cellLabel({ date, formatted })`, `heading({ formatted })`, and for range
`startPrompt`, `endPrompt({ start })`, `anchorSet({ start })`, `rangeSelected({ start, end })`. Dates in
messages SHALL be formatted by the picker in its locale and calendar.

#### Scenario: Italian names

- **WHEN** `messages={{ next: "Anno successivo" }}` is set
- **THEN** the next trigger is named "Anno successivo"

### Requirement: Data Attributes

Every part SHALL carry `data-scope`, `data-part` and `data-instance`. Root and grid SHALL carry
`data-disabled`, `data-readonly`, `data-invalid` and `data-focus` / `data-focus-visible` while focus is
in the grid, and in range mode `data-anchored`. Each cell SHALL carry `data-value` (ISO date of the
month's first day) and when they apply `data-selected`, `data-current`, `data-disabled`,
`data-unavailable`, `data-invalid`, `data-focus`, `data-focus-visible`, `data-hover`, `data-pressed`, and
in range mode `data-in-range`, `data-selection-start`, `data-selection-end`, `data-anchor`,
`data-preview`, `data-preview-start`, `data-preview-end`. Triggers SHALL carry `data-disabled` and
`data-pressed`. `data-variant` and `data-size` SHALL pass through untouched.

#### Scenario: One focus ring

- **WHEN** the user pages with the keyboard across ten years
- **THEN** after every step exactly one cell carries `data-focus-visible`

#### Scenario: Anchor is not a range end (react-spectrum#5456)

- **WHEN** an anchor is set and no range exists
- **THEN** the anchor cell has `data-anchor` and no `data-selection-end`

### Requirement: Contract

The Month Picker SHALL ship a contract with scope `month-picker`, located by role `group` and exact
accessible name, with anatomy as above and:

- actions: `select(month)` (pointer: click the cell named by the month; keyboard: PageUp/PageDown to the
  year, then arrows to the month, then Enter; virtual: bare click), `selectRange(start, end)` (range
  mode; click-click, Enter-Enter, tap-tap), `focusPeriod(month)` (keyboard only), `nextPage()` /
  `previousPage()`, `press(key)`, `cancel()` (Escape);
- queries: `value()` (ISO of months with `aria-selected="true"`, or the range), `range()`,
  `anchor()`, `preview()`, `focusedPeriod()`, `heading()`, `isSelected(month)`, `isUnavailable(month)`,
  `isDisabled(month)`, `current()`, `announcements()`;
- states `idle`, `anchored`, observed through `data-anchored` on the root;
- events: `CELL.PRESS` and `SELECT_FOCUSED` map to `select` / `selectRange`, `NAVIGATE` to `press`, `PAGE`
  to `nextPage` / `previousPage`, `CANCEL` to `cancel`, `CELL.FOCUS`, `GRID.FOCUS`, `GRID.BLUR`,
  `CELL.HOVER` and `LEAVE` `skip` ("covered by every action"), prop steps `$sync:value`,
  `$sync:focusedValue`, `$props:minValue`, `$props:disabled`;
- traits `selectable`, `composite-roving`, plus the period invariants.

#### Scenario: Same test in both environments

- **WHEN** `getMonthPicker(screen, { name: "Billing month" }).select("2027-03")` runs in jsdom and with a
  Playwright `page`, starting from 2026
- **THEN** both resolve with `value()` equal to `["2027-03-01"]`

### Requirement: Period Invariants

The contract SHALL ship invariants checked after every model step: exactly one cell has `tabIndex=0`
and it is the focused month's cell; the focused month is within the constraints and on the shown page; at
most one cell carries `data-focus`; the heading equals the formatted page; `aria-selected="true"` is on
exactly the oracle's selected months; `aria-current="date"` is on exactly the current month when shown;
no cell is `role="button"` or contains a focusable descendant; `onValueChange` was called exactly as
often as the oracle's value changed; in range mode `data-preview*` appears only while an anchor is
set and the value is `null` or has `start ≤ end`.

#### Scenario: Broken wrapper adds a button inside cells

- **WHEN** a consumer wrapper renders a focusable `button` inside each cell
- **THEN** the first keyboard step fails, naming the roving tab-stop invariant

### Requirement: Theme

`@rind-ui/theme` SHALL style the Month Picker in `month-picker.css` with `--rind-month-picker-*`
tokens read with semantic fallbacks, the root in family `panel` and the cells in family `collection
item`: cells at least 24×24 CSS px (default wide enough for a short month name at 320 px in 4
columns), a focus ring on `data-focus-visible`, selected cells distinguishable without colour (an edge in
the palette `border` role), the current month with a border, unavailable with a strike-through, range
middle, ends, anchor and preview distinguishable, a `data-tone="danger"` invalid state, and every state
visible under forced colors.

#### Scenario: Forced colors

- **WHEN** a Month Picker with a selected range, a current month and an unavailable month is rendered
  under forced colors
- **THEN** the range (`Highlight`), the current month (border), the unavailable month (strike-through,
  `GrayText`) and the focused cell (outline) are all distinguishable
