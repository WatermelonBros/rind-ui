## Purpose

Defines how a calendar grid moves its focused date and its visible months — by day, week, week
edge, month and year, constrained by minimum and maximum dates — as pure date logic shared by
Calendar, Range Calendar and later Month/Year Picker. Introduced by `add-calendar`.

## ADDED Requirements

### Requirement: Moves

The navigation SHALL compute, from a focused date and a move, the next focused date:

- `next-day` / `previous-day`: ±1 day;
- `next-week` / `previous-week`: ±7 days;
- `week-start` / `week-end`: the first / last day of the focused date's week, using the
  component's first day of the week;
- `next-month` / `previous-month`: the same day number one month later / earlier, or the last
  day of that month when it is shorter;
- `next-year` / `previous-year`: the same month and day one year later / earlier, with the same
  rule.

Month and year moves SHALL use the display calendar system's month lengths and month counts.
The module SHALL run without a DOM and without the current time.

#### Scenario: Month end clamps (APG)

- **WHEN** the focused date is 31 January 2026 and the move is `next-month`
- **THEN** the focused date is 28 February 2026

#### Scenario: Leap day to the next year

- **WHEN** the focused date is 29 February 2028 and the move is `next-year`
- **THEN** the focused date is 28 February 2029

#### Scenario: Week start with Monday weeks

- **WHEN** the first day is Monday, the focused date is Sunday 18 October 2026 and the move
  is `week-start`
- **THEN** the focused date is Monday 12 October 2026

#### Scenario: Hebrew leap year

- **WHEN** a hebrew calendar focuses 30 Shevat in a leap year and the move is `next-month`
- **THEN** the focused date is 30 Adar I

### Requirement: Constraints On Moves

A move whose result is before `minValue` or after `maxValue` SHALL clamp to that bound; a move
from the bound further out SHALL leave the focused date unchanged. Moves SHALL land on
unavailable dates normally (they stay focusable). A focused date given by a controlled prop or
a changed constraint outside the bounds SHALL be clamped into them.

#### Scenario: Arrow past the minimum

- **WHEN** `minValue` is 10 October 2026, the focused date is 10 October and the move is
  `previous-day`
- **THEN** the focused date stays 10 October

#### Scenario: Month move clamps to the maximum

- **WHEN** `maxValue` is 20 November 2026, the focused date is 25 October and the move is
  `next-month`
- **THEN** the focused date is 20 November

#### Scenario: Unavailable stays reachable (zag#2474)

- **WHEN** 15 October is unavailable, the focused date is 14 October and the move is
  `next-day`
- **THEN** the focused date is 15 October

### Requirement: Visible Range

The navigation SHALL maintain the first visible month for `visibleMonths` consecutive months.
After a move, when the focused date is still visible the visible range SHALL NOT change; when
it moved before the range, the range SHALL end at the focused date's month; when after, it SHALL
start at the focused date's month. Paging SHALL move the visible range by `visibleMonths`
months (`pageBehavior: "visible"`, default) or by one month (`"single"`), move the focused date
by the same amount with the month clamping rule, and never start before the month of
`minValue` or end after the month of `maxValue`.

#### Scenario: Moving within two visible months

- **WHEN** October and November 2026 are visible and the focus moves from 31 October to
  1 November
- **THEN** October and November stay visible

#### Scenario: Paging two months

- **WHEN** October and November are visible, `pageBehavior` is `visible` and the user pages
  forward with the focus on 14 October
- **THEN** December and January are visible and the focus is on 14 December

#### Scenario: Paging blocked by the maximum

- **WHEN** `maxValue` is in November and November is the last visible month
- **THEN** paging forward is not possible

### Requirement: Initial Focused Date

Without a focused-date prop, the initial focused date SHALL be the value (the first value in
multiple selection, the start in a range), else today, clamped into the constraints; the
initial visible range SHALL contain it.

#### Scenario: Only past dates allowed (bits-ui#1262)

- **WHEN** a calendar has no value, today is 14 October 2026 and `maxValue` is 1 June 2026
- **THEN** June 2026 is visible and 1 June is focused
</content>
</invoke>
