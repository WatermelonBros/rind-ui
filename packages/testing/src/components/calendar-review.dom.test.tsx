// Review r1 (#97): a controlled focus outside min/max, one change per key in multiple mode,
// a ZonedDateTime value across a DST gap with a fixed clock.
import { CalendarDate, parseZonedDateTime, type ZonedDateTime } from "@internationalized/date"
import { Calendar, type CalendarRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { fixedDateClock, getCalendar } from "../index"

function Cal(
  props: Partial<CalendarRootProps> & { readonly clock?: ReturnType<typeof fixedDateClock> },
) {
  const { clock = fixedDateClock("2026-10-14T12:00:00Z"), ...root } = props
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <Calendar.Root aria-label="Departure" firstDayOfWeek="sun" {...root}>
        <Calendar.Header>
          <Calendar.PrevTrigger />
          <Calendar.Heading />
          <Calendar.NextTrigger />
        </Calendar.Header>
        <Calendar.Grid />
      </Calendar.Root>
    </RindProvider>
  )
}

const cell = (iso: string) =>
  document.querySelector(
    `[role="gridcell"][data-value="${iso}"]:not([data-outside-month])`,
  ) as HTMLElement
const key = (k: string) =>
  act(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    )
  })

describe("Calendar review r1", () => {
  it("a controlled focusedValue before minValue focuses the minimum; disabled cells are never tab stops", () => {
    render(
      <Cal
        focusedValue={new CalendarDate(2026, 10, 2)}
        minValue={new CalendarDate(2026, 10, 10)}
        maxValue={new CalendarDate(2026, 10, 25)}
      />,
    )
    const stops = [...document.querySelectorAll('[role="gridcell"][tabindex="0"]')]
    expect(stops.map((c) => c.getAttribute("data-value"))).toEqual(["2026-10-10"])
    for (const c of document.querySelectorAll('[role="gridcell"][data-disabled]')) {
      expect(c.hasAttribute("tabindex")).toBe(false)
    }
  })

  it("Enter and Space in multiple mode change the value exactly once each", async () => {
    const onValueChange = vi.fn()
    render(
      <Cal
        selectionMode="multiple"
        defaultFocusedValue={new CalendarDate(2026, 10, 14)}
        onValueChange={onValueChange}
      />,
    )
    await getCalendar(screen, { name: "Departure" }).via("keyboard").focusDate("2026-10-14")
    key("Enter")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(cell("2026-10-14").getAttribute("aria-selected")).toBe("true")
    key("ArrowRight")
    key(" ")
    expect(onValueChange).toHaveBeenCalledTimes(2)
    expect(cell("2026-10-15").getAttribute("aria-selected")).toBe("true")
  })

  it("a ZonedDateTime across the spring-forward gap keeps its zone and time; today follows the clock's zone", async () => {
    const onValueChange = vi.fn()
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 → 03:00).
    const inGap = parseZonedDateTime("2026-03-08T02:30[America/New_York]")
    render(
      <Cal
        clock={fixedDateClock("2026-03-08T07:30:00Z", "America/New_York")}
        defaultValue={inGap}
        onValueChange={onValueChange}
      />,
    )
    expect(cell("2026-03-08").getAttribute("aria-selected")).toBe("true")
    expect(cell("2026-03-08").getAttribute("aria-current")).toBe("date")
    await getCalendar(screen, { name: "Departure" }).via("pointer").select("2026-03-10")
    const emitted = onValueChange.mock.lastCall?.[0] as ZonedDateTime
    expect(emitted.timeZone).toBe("America/New_York")
    expect([emitted.day, emitted.hour, emitted.minute]).toEqual([10, inGap.hour, inGap.minute])
  })
})
