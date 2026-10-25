// Model-based tests (React's, against the Angular parts): the Calendar contract over the configurations of design §5 (task 7.1), range selection
// (the others: calendar*.model.dom.test.tsx).
import { isWeekend } from "@internationalized/date"
import { config } from "../../fixtures/calendar-model"

config("range", { selectionMode: "range" })
config("range, 2–7 days", { selectionMode: "range", minRangeLength: 2, maxRangeLength: 7 })
config("range, weekends unavailable (contiguous)", {
  selectionMode: "range",
  isDateUnavailable: (d) => isWeekend(d, "en-US"),
})
config("range, weekends unavailable (non-contiguous)", {
  selectionMode: "range",
  isDateUnavailable: (d) => isWeekend(d, "en-US"),
  allowsNonContiguousRanges: true,
})
