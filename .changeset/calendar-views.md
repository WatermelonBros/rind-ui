---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Calendar month and year views with drill-down: a controllable `view` (`"days"`, `"months"`, `"years"`; `defaultView`, `onViewChange(view, { reason })`) bounded by `minView` / `maxView`, `yearsPerPage`, `columns`, `monthFormat`, `isMonthUnavailable` and `isYearUnavailable`. The heading becomes a button one view up (`messages.viewUp`), choosing a period above `minView` goes back down, and Escape goes down one view. With `minView="months"` or `"years"` the Calendar is a month or year picker: the day, time and zone of the value are kept, the day clamped. Single, multiple and range selection work at the period. The pure `period-navigation` helpers (`pageOf`, `movePeriod`, `canPagePeriod`, `periodAllowed`, …) are exported; `messages.previous` / `next` take a string or a function of the view. The driver adds `viewUp()`, `viewDown()` and `view()`, and accepts periods (`"2027-03"`, `"2031"`); the `composite-roving` invariant now fails on a focusable control inside a grid cell. `calendar.css` styles the view button and the wider period cells.
