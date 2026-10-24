// Model-based tests (React's, against the Vue parts): the Calendar contract over the configurations of design §5 (task 7.1), single and multiple selection by day
// (the others: calendar*.model.dom.test.tsx).
import { CalendarDate, isWeekend } from "@internationalized/date"
import { config } from "../../fixtures/calendar-model"

config("en-US, one month", {})
config("en-GB, Monday weeks", { locale: "en-GB", firstDayOfWeek: "mon" })
config("two months, single paging", { visibleMonths: 2, pageBehavior: "single" })
config("multiple selection", { selectionMode: "multiple" })
config("min and max", {
  minValue: new CalendarDate(2026, 10, 5),
  maxValue: new CalendarDate(2026, 11, 20),
})
config("weekends unavailable", { isDateUnavailable: (d) => isWeekend(d, "en-US") })
config("read-only", { readOnly: true })
