// The page date-field-component.pw.test.ts drives: public Date Field, bundled by the test itself.
import { CalendarDate } from "@internationalized/date"
import { DateField, RindProvider } from "@rind-ui/react"
import { createRoot } from "react-dom/client"

const clock = { now: () => Date.parse("2026-10-17T12:00:00Z"), timeZone: () => "UTC" }

function App() {
  const locale = new URLSearchParams(location.search).get("locale") ?? "en-US"
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <form style={{ padding: 24 }} onSubmit={(e) => e.preventDefault()}>
        <DateField.Root name="birthday" locale={locale} maxValue={new CalendarDate(2030, 12, 31)}>
          <DateField.Label>Birthday</DateField.Label>
          <DateField.Input />
        </DateField.Root>
        <div style={{ height: 3000 }} />
        <button type="reset">Reset</button>
      </form>
    </RindProvider>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />)
