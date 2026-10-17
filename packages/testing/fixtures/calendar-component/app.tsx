// The page calendar-component.pw.test.ts drives: public Calendar, bundled by the test itself.
import { CalendarDate } from "@internationalized/date"
import { Calendar } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

function App() {
  return (
    <div style={{ padding: 24, width: 360 }}>
      <Calendar.Root
        aria-label="Departure"
        firstDayOfWeek="sun"
        defaultFocusedValue={new CalendarDate(2026, 10, 14)}
        minValue={new CalendarDate(2026, 10, 5)}
        isDateUnavailable={(d) => d.month === 10 && d.day === 20}
      >
        <Calendar.Header>
          <Calendar.PrevTrigger />
          <Calendar.Heading />
          <Calendar.NextTrigger />
        </Calendar.Header>
        <Calendar.Grid />
      </Calendar.Root>
      <div style={{ height: 3000 }} />
      <button type="button">After</button>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
