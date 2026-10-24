// Model-based tests (React's, against the Svelte parts): the Calendar contract over the configurations of design §5 (task 7.1), month and year views and display calendars
// (the others: calendar*.model.dom.test.tsx).
import { CalendarDate, createCalendar } from "@internationalized/date"
import { config } from "../../fixtures/calendar-model"

// Month and year views (spec "Month And Year Views"): the value is chosen at the period.
config("month view", { minView: "months" })
config("month view, columns 3, unavailable August", {
  minView: "months",
  columns: 3,
  isMonthUnavailable: (m) => m.month === 8,
})
config("month view, range", { minView: "months", selectionMode: "range" })
config("year view", { minView: "years" })
config("year view, min and max", {
  minView: "years",
  minValue: new CalendarDate(2020, 6, 1),
  maxValue: new CalendarDate(2031, 6, 1),
})
// Display calendars: the oracle stays gregorian (paths and values are by day).
void createCalendar
