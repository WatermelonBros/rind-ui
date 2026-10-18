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
