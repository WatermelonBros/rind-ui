# period-navigation Specification

## Purpose
TBD - created by archiving change date-family-consolidation. Update Purpose after archive.
## Requirements
### Requirement: Pages And Grid Shape

A **page** SHALL be, for months, the months of one year of the display calendar system (12, or
13 in a hebrew leap year, ethiopic and coptic years) and, for years, `yearsPerPage` consecutive
years (default 12). Year pages SHALL be fixed partitions of the display calendar's year
numbering (the page of year `y` starts at the greatest multiple of `yearsPerPage` not above `y`,
counted within the era), so paging never drifts, and a page SHALL never straddle an era boundary:
it is truncated at the era's first or last year. The grid SHALL be laid out in rows of `columns`
cells (default 4; any integer from 1 to the number of cells), the last row possibly shorter. The
module SHALL run without a DOM and without the current time.

#### Scenario: Twelve months in three rows

- **WHEN** the page is 2026 in a gregorian calendar and `columns` is 4
- **THEN** the page has 12 months in 3 rows of 4

#### Scenario: Thirteen months (hebrew leap year)

- **WHEN** the page is the hebrew year 5784 (a leap year)
- **THEN** it has 13 months in 4 rows, the last row holding one month

#### Scenario: Fixed year pages

- **WHEN** `yearsPerPage` is 12 and the focused year is 2026, then the user pages forward
  and back several times
- **THEN** the pages are 2016–2027, 2028–2039 and back to 2016–2027, never 2026–2037

#### Scenario: Era boundary (japanese)

- **WHEN** a japanese-calendar year page contains the end of Heisei (31) and the start of Reiwa
- **THEN** the page ends at Heisei 31 and the next page starts at Reiwa 1

### Requirement: Moves

The navigation SHALL compute, from a focused period (a date at the first day of its month or
year), the next focused period for each move:

- `next` / `previous`: one period later / earlier, moving to the adjacent page at a page edge;
- `next-row` / `previous-row`: the period in the adjacent row and the same column; from the
  last row it SHALL go to the first row of the next page, from the first row to the last row of the
  previous page, in the same column, or the last period of that row when the column does not
  exist there;
- `first` / `last`: the first / last period of the current page;
- `next-page` / `previous-page`: the same position on the adjacent page (the same month of the next
  year, clamped to the months that year has; the same offset in the next block of years).

Month moves SHALL use the display calendar's month counts per year. A move SHALL always return
the focused period and the page start that contains it.

#### Scenario: Right across the year boundary

- **WHEN** December 2026 is focused and the move is `next`
- **THEN** January 2027 is focused and 2027 is the page

#### Scenario: Down keeps the column (reka-ui#2781)

- **WHEN** `columns` is 3, March 2026 (row 1, column 3) is focused and the move is `next-row`
- **THEN** June 2026 is focused, not a diagonal period

#### Scenario: Down from the last row

- **WHEN** `columns` is 4 and November 2026 (row 3, column 3) is focused and the move is `next-row`
- **THEN** March 2027 (row 1, column 3 of the next page) is focused

#### Scenario: Short last row (13 months)

- **WHEN** the page is a hebrew leap year, the focused month is the 13th (row 4, column 1) and the
  move is `next-row`
- **THEN** the first row, first column of the next year is focused; and from the 12th month
  (row 3, column 4) `next-row` focuses the 13th

#### Scenario: Page keeps the month

- **WHEN** October 2026 is focused and the move is `next-page`
- **THEN** October 2027 is focused (a gregorian page never clamps); in a hebrew calendar the
  13th month of a leap year goes to the 12th, the last month, of the following common year

#### Scenario: First and last

- **WHEN** a year page 2016–2027 has 2021 focused and the move is `last`
- **THEN** 2027 is focused

### Requirement: Constraints On Moves

Constraints SHALL be compared at the period: a month is inside `[minValue, maxValue]` when any of
its days is, a year when any of its days is. A move whose result is outside SHALL clamp to the
nearest allowed period; a move from the bound further out SHALL leave the focus unchanged.
Unavailable periods SHALL be reachable (they stay focusable). A focused period outside the
constraints, from a controlled prop or a changed constraint, SHALL be clamped into them. A page
SHALL be reachable only if it contains an allowed period.

#### Scenario: Min and max within two adjacent years (zag#2153)

- **WHEN** `minValue` is 15 December 2025 and `maxValue` is 20 February 2026, in the Calendar year view
- **THEN** both 2025 and 2026 are allowed, and 2024 and 2027 are not

#### Scenario: Month containing the minimum

- **WHEN** `minValue` is 15 October 2026 in the Calendar month view
- **THEN** October 2026 is allowed and September 2026 is not

#### Scenario: Arrow past the minimum

- **WHEN** the focused month is the month of `minValue` and the move is `previous`
- **THEN** the focused month is unchanged

#### Scenario: Unavailable stays reachable

- **WHEN** May is unavailable and the move is `next` from April
- **THEN** May is focused

### Requirement: Initial Focused Period

Without a focused-date prop, the initial focused period SHALL be the value's period (the start's
for a range), else the current period (from the date clock), clamped into the constraints, and the
initial page SHALL contain it, so that the focused cell always exists.

#### Scenario: Minimum in the next year (bits-ui#1873)

- **WHEN** no value is set, today is in 2026 and `minValue` is 1 January 2027, in the Calendar month view
- **THEN** the page is 2027, January 2027 is focused and exactly one cell has `tabindex="0"`

#### Scenario: Pages without allowed periods are not reachable

- **WHEN** `maxValue` is in 2026 and the user pages forward from the page containing 2026
- **THEN** paging is not possible

