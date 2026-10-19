// Browser only (real mouse through vitest/browser): a press on the group outside a segment.
import { CalendarDate } from "@internationalized/date"
import { DateField, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { fixedDateClock } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")

describe("Date Field group press", () => {
  it("focuses the last filled segment before the press point, else the first", async () => {
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <DateField.Root defaultValue={new CalendarDate(2026, 10, 14)}>
          <DateField.Label>Birthday</DateField.Label>
          <DateField.Input style={{ display: "inline-block", paddingInline: "2rem" }} />
        </DateField.Root>
      </RindProvider>,
    )
    const group = screen.getByRole("group", { name: "Birthday" })
    const box = group.getBoundingClientRect()
    await userEvent.click(group, { position: { x: box.width - 4, y: box.height / 2 } })
    expect(document.activeElement?.getAttribute("data-type")).toBe("year")
    await userEvent.click(group, { position: { x: 4, y: box.height / 2 } })
    expect(document.activeElement?.getAttribute("data-type")).toBe("month")
  })
})

// date-field spec "Picker — State Kept Until Exit" (zag#3188): the exiting content keeps the
// month the user paged to.
describe("Date Field picker exit", () => {
  it("no flash on close: the exiting calendar keeps the paged month", async () => {
    const { Calendar } = await import("@rind-ui/react")
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <style>{`@keyframes rind-test-picker-exit { from { opacity: 1 } to { opacity: 0 } }
[data-scope="date-field"][data-part="content"][data-state="closed"] { animation: rind-test-picker-exit 400ms linear forwards }`}</style>
        <DateField.Root locale="en-US" defaultValue={new CalendarDate(2026, 10, 14)}>
          <DateField.Label>Birthday</DateField.Label>
          <DateField.Control>
            <DateField.Input />
            <DateField.Trigger>▾</DateField.Trigger>
          </DateField.Control>
          <DateField.Portal>
            <DateField.Positioner>
              <DateField.Content>
                <DateField.Calendar>
                  <Calendar.Header>
                    <Calendar.PrevTrigger />
                    <Calendar.Heading />
                    <Calendar.NextTrigger />
                  </Calendar.Header>
                  <Calendar.Grid />
                </DateField.Calendar>
              </DateField.Content>
            </DateField.Positioner>
          </DateField.Portal>
        </DateField.Root>
      </RindProvider>,
    )
    const content = () =>
      document.querySelector<HTMLElement>('[data-scope="date-field"][data-part="content"]')
    const heading = () =>
      content()?.querySelector('[data-scope="calendar"][data-part="heading"]')?.textContent
    await userEvent.click(screen.getByRole("button", { name: "Choose date Birthday" }))
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("open")
    expect(heading()).toBe("October 2026")
    await userEvent.click(screen.getByRole("button", { name: /next/i }))
    await expect.poll(() => heading()).toBe("November 2026")
    await userEvent.keyboard("{Escape}")
    await expect.poll(() => content()?.getAttribute("data-state")).toBe("closed")
    // Every frame of the exit shows November, until the content unmounts.
    while (content()) {
      expect(heading()).toBe("November 2026")
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
    }
  })
})
