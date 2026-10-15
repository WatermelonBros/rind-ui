## Purpose

Defines rind-ui's Year Picker: a grid of consecutive years where the user moves a focused year with
the keyboard, pointer or touch and selects one year or a range of years. It is the Month Picker
(`month-picker`) with years as the unit: every requirement of `month-picker` applies with "year" for
"month" except where this capability says otherwise. Introduced by `add-month-year-picker`.

## ADDED Requirements

### Requirement: Month Picker Parity

The Year Picker SHALL meet the requirements Anatomy, Value And Selection, Focused Period And Page,
Keyboard Interaction, Pointer And Touch, Constraints, Unavailable And Disabled Months (as years, with
`isYearUnavailable`), Disabled And Read-Only, Range Selection, Grid Semantics, Cell Names And States,
Triggers, Announcements, Messages, Data Attributes, Contract, Period Invariants and Theme of
`month-picker`, with scope `year-picker`, the unit replaced by the year, the page being a block of years
(`period-navigation`), and the differences below. Choosing a year SHALL emit the current value with only
its year changed, 29 February clamped to 28 February, keeping type, calendar, time of day and time zone;
with no value it SHALL emit 1 January of the year.

#### Scenario: Month, day and time kept (reka-ui#2588)

- **WHEN** the value is `CalendarDateTime(2026, 10, 14, 9, 30)` and the user selects 2031
- **THEN** the emitted value is `CalendarDateTime(2031, 10, 14, 9, 30)`

#### Scenario: Leap day

- **WHEN** the value is 29 February 2028 and the user selects 2029
- **THEN** the emitted value is 28 February 2029

#### Scenario: Both years selectable (zag#2153)

- **WHEN** `minValue` is 15 December 2025 and `maxValue` is 20 February 2026
- **THEN** the cells of 2025 and 2026 can be selected and the other cells are disabled

#### Scenario: Years outside the first page are reachable (zag#3336)

- **WHEN** no `minValue` or `maxValue` is set and the user presses the next trigger
- **THEN** the next block of years is shown with no disabled cell

### Requirement: Pages Of Years

The grid SHALL show `yearsPerPage` consecutive years (default 12) in rows of `columns` (default 4),
paged as `period-navigation` defines. The heading SHALL show the first and last year of the page as a
range formatted by the display calendar ("2016 – 2027"). PageUp / PageDown SHALL move to the previous /
next page, keeping the position in the page; Home / End to the first / last year of the page. The
triggers SHALL page by `yearsPerPage` and be named by `messages.previous` / `messages.next` (default
"Previous years" / "Next years"). A change of `yearsPerPage` SHALL keep the focused year and realign the
page.

#### Scenario: Default page

- **WHEN** a Year Picker is rendered with the focused year 2026 in `en-US`
- **THEN** the heading reads "2016 – 2027", the grid has three rows of four cells for 2016 to 2027 and
  the cell of 2026 has `tabindex="0"`

#### Scenario: Ten years per page

- **WHEN** `yearsPerPage={10}` and `columns={5}` are set
- **THEN** the page is 2020–2029 in two rows of five

#### Scenario: Paging keeps the position (zag#1906)

- **WHEN** 2021 (the sixth year of its page) is focused and PageDown is pressed
- **THEN** 2033 (the sixth year of the next page) is focused and the heading reads "2028 – 2039"

#### Scenario: Page change announced

- **WHEN** the next trigger is pressed with focus on it
- **THEN** one announcement "2028 – 2039" is made

### Requirement: Year Names And Eras

A year cell's text SHALL be the `year` part of the date formatted in the display calendar (buddhist
`2569`, japanese `令和8年` as its locale formats it, cyclic related years mapped as `date-values`
defines), and its name `messages.cellLabel` applied to the year (default: the localised year, with the
era when the calendar shows eras, e.g. "2026" or "5 BC"). `aria-current="date"` SHALL be on the current
year. In calendars with eras a page SHALL NOT straddle an era boundary and paging forward from the last
page of an era SHALL continue with the first page of the next era.

#### Scenario: Buddhist years

- **WHEN** the locale is `th-TH` with `createCalendar`
- **THEN** the cell for 2026 reads "2569" and its `data-value` is "2026-01-01"

#### Scenario: BC years

- **WHEN** a gregorian page shows 3 BC to 8 BC
- **THEN** the cells are named with their era ("3 BC") and the value emitted for the cell of 3 BC is a
  gregorian BC date

### Requirement: Theme

`@rind-ui/theme` SHALL style the Year Picker in `year-picker.css` exactly as `month-picker.css`
styles the Month Picker (same families `panel` and `collection item`), with `--rind-year-picker-*`
tokens read with semantic fallbacks, sharing its rules through the same selectors on scope
`year-picker`.

#### Scenario: Forced colors

- **WHEN** a Year Picker with a selected year and the current year is rendered under forced colors
- **THEN** both are distinguishable and the focused cell has an outline
