// Calendar through its driver: runs unchanged in jsdom and in real browsers (a fixed clock).
import { CalendarDate, createCalendar, isWeekend } from "@internationalized/date"
import { Calendar, type CalendarRootProps, RindProvider } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCalendar, installAnnouncementLog } from "../index"

const clock = { now: () => Date.parse("2026-10-14T12:00:00Z"), timeZone: () => "UTC" }
const cal = (name = "Departure") => getCalendar(screen, { name })
const cell = (name: string) => screen.getByRole("gridcell", { name })

function Cal(props: Partial<CalendarRootProps> & { readonly twoTriggers?: boolean }) {
  const { twoTriggers, ...root } = props
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <Calendar.Root aria-label="Departure" firstDayOfWeek="sun" {...root}>
        <Calendar.Header>
          <Calendar.PrevTrigger />
          <Calendar.Heading />
          <Calendar.NextTrigger />
        </Calendar.Header>
        {Array.from({ length: root.visibleMonths ?? 1 }, (_, m) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: months are positions
          <Calendar.Grid key={m} month={m} />
        ))}
        {twoTriggers ? <Calendar.NextTrigger /> : null}
      </Calendar.Root>
    </RindProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("Calendar", () => {
  it("Default month: one grid, five rows, heading, named triggers", async () => {
    render(<Cal />)
    expect(screen.getAllByRole("grid")).toHaveLength(1)
    expect(screen.getAllByRole("row")).toHaveLength(5)
    expect(await cal().heading()).toBe("October 2026")
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy()
  })

  it("Name and states of today, selected", async () => {
    render(<Cal defaultValue={new CalendarDate(2026, 10, 14)} />)
    const c = cell("Wednesday, October 14, 2026")
    expect(c.getAttribute("aria-selected")).toBe("true")
    expect(c.getAttribute("aria-current")).toBe("date")
    expect(c.textContent).toBe("14")
    expect(await cal().today()).toBe("2026-10-14")
  })

  it("Explicit unselected state on every selectable cell", () => {
    render(<Cal defaultValue={new CalendarDate(2026, 10, 14)} />)
    for (const c of screen.getAllByRole("gridcell")) {
      expect(["true", "false"]).toContain(c.getAttribute("aria-selected"))
    }
  })

  it("Click selects (driver, same test everywhere)", async () => {
    const onValueChange = vi.fn()
    render(<Cal onValueChange={onValueChange} />)
    await cal().select("2026-10-20")
    expect(await cal().value()).toEqual(["2026-10-20"])
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(String(onValueChange.mock.calls[0]?.[0])).toBe("2026-10-20")
  })

  it("select pages to another month (pointer and keyboard)", async () => {
    const { unmount } = render(<Cal />)
    await cal().select("2026-11-03")
    expect(await cal().value()).toEqual(["2026-11-03"])
    unmount()
    render(<Cal />)
    await cal().via("keyboard").select("2026-11-03")
    expect(await cal().value()).toEqual(["2026-11-03"])
  })

  it("Focus does not select (cause C)", async () => {
    render(<Cal />)
    act(() => cell("Wednesday, October 21, 2026").focus())
    expect(await cal().value()).toEqual([])
    await waitFor(async () => expect(await cal().focusedDate()).toBe("2026-10-21"))
  })

  it("Multiple toggle", async () => {
    render(<Cal selectionMode="multiple" />)
    await cal().select("2026-10-03")
    await cal().select("2026-10-10")
    await cal().select("2026-10-03")
    expect(await cal().value()).toEqual(["2026-10-10"])
    expect(screen.getByRole("grid").getAttribute("aria-multiselectable")).toBe("true")
  })

  it("Week edge, next year, arrow crosses the month (keyboard)", async () => {
    render(<Cal />)
    await cal().via("keyboard").focusDate("2026-10-14")
    await cal().press("Home")
    expect(await cal().focusedDate()).toBe("2026-10-11")
    await cal().press("End")
    await cal().press("ArrowRight")
    expect(await cal().focusedDate()).toBe("2026-10-18")
    await cal().via("keyboard").focusDate("2026-10-31")
    await cal().press("ArrowRight")
    expect(await cal().focusedDate()).toBe("2026-11-01")
    expect(await cal().heading()).toBe("November 2026")
  })

  it("Arabic arrows: ArrowLeft is the next day in rtl", async () => {
    render(<Cal dir="rtl" />)
    await cal().via("keyboard").focusDate("2026-10-14")
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      )
    })
    await waitFor(async () => expect(await cal().focusedDate()).toBe("2026-10-15"))
  })

  it("Two months: two named grids, placeholders never selected (react-spectrum#3257)", async () => {
    // Monday weeks: the week of 31 October ends on 1 November.
    render(<Cal visibleMonths={2} firstDayOfWeek="mon" />)
    const grids = screen.getAllByRole("grid")
    expect(grids.map((g) => g.getAttribute("aria-label"))).toEqual([
      "October 2026",
      "November 2026",
    ])
    const placeholder = grids[0]?.querySelector('[data-value="2026-11-01"]') as HTMLElement
    expect(placeholder.hasAttribute("data-outside-month")).toBe(true)
    act(() => placeholder.click())
    expect(await cal().value()).toEqual([])
  })

  it("Unavailable is not disabled (react-spectrum#6108); Enter on it does nothing (#5692)", async () => {
    render(<Cal isDateUnavailable={(d) => isWeekend(d, "en-US")} />)
    const sat = cell("Saturday, October 17, 2026")
    expect(sat.hasAttribute("data-unavailable")).toBe(true)
    expect(sat.hasAttribute("data-disabled")).toBe(false)
    expect(sat.getAttribute("aria-disabled")).toBe("true")
    await cal().via("keyboard").focusDate("2026-10-17")
    await cal().press("Enter")
    expect(await cal().value()).toEqual([])
  })

  it("Unavailable value is invalid", async () => {
    render(
      <Cal
        value={new CalendarDate(2026, 10, 17)}
        isDateUnavailable={(d) => isWeekend(d, "en-US")}
      />,
    )
    expect(await cal().isInvalid()).toBe(true)
    const c = cell("Saturday, October 17, 2026")
    expect(c.getAttribute("aria-invalid")).toBe("true")
    expect(c.getAttribute("aria-selected")).toBe("true")
  })

  it("Maximum date selectable (reka-ui#1455); trigger at the maximum keeps focus", async () => {
    render(<Cal maxValue={new CalendarDate(2026, 10, 31)} />)
    await cal().select("2026-10-31")
    expect(await cal().value()).toEqual(["2026-10-31"])
    const next = screen.getByRole("button", { name: "Next month" })
    expect(next.getAttribute("aria-disabled")).toBe("true")
    act(() => next.focus())
    act(() => next.click())
    expect(document.activeElement).toBe(next)
    expect(await cal().heading()).toBe("October 2026")
  })

  it("Disabled keeps the selection visible (react-spectrum#8542)", () => {
    render(<Cal disabled defaultValue={new CalendarDate(2026, 10, 14)} />)
    const c = cell("Wednesday, October 14, 2026")
    expect(c.getAttribute("aria-selected")).toBe("true")
    expect(c.hasAttribute("data-selected")).toBe(true)
    expect(screen.getByRole("grid").getAttribute("aria-disabled")).toBe("true")
    expect(screen.getAllByRole("gridcell").every((g) => g.tabIndex < 0)).toBe(true)
  })

  it("Read-only navigation", async () => {
    render(<Cal readOnly />)
    await cal().via("keyboard").focusDate("2026-10-14")
    await cal().press("ArrowRight")
    await cal().press("Enter")
    expect(await cal().focusedDate()).toBe("2026-10-15")
    expect(await cal().value()).toEqual([])
    expect(screen.getByRole("grid").getAttribute("aria-readonly")).toBe("true")
  })

  it("Focus lands on the gridcell; no application role", async () => {
    render(<Cal />)
    await cal().via("keyboard").focusDate("2026-10-14")
    expect(document.activeElement?.getAttribute("role")).toBe("gridcell")
    expect(document.querySelector('[role="application"]')).toBe(null)
  })

  it("Header focusables stay exposed (bits-ui#902)", () => {
    render(<Cal />)
    const next = screen.getByRole("button", { name: "Next month" })
    expect(next.closest('[aria-hidden="true"]')).toBe(null)
  })

  it("German names (messages and locale)", () => {
    render(<Cal locale="de-DE" messages={{ next: "Nächster Monat" }} />)
    expect(screen.getByRole("button", { name: "Nächster Monat" })).toBeTruthy()
    expect(cell("Mittwoch, 14. Oktober 2026")).toBeTruthy()
  })

  it("Persian locale with createCalendar", async () => {
    render(<Cal locale="fa-IR" createCalendar={createCalendar} />)
    expect(await cal().heading()).toMatch(/۱۴۰۵/)
  })

  it("Controlled focus pages and reports the visible range", async () => {
    const onVisibleRangeChange = vi.fn()
    function Controlled() {
      const [focused, setFocused] = useState(new CalendarDate(2026, 10, 14))
      return (
        <>
          <Cal
            focusedValue={focused}
            onFocusChange={setFocused}
            onVisibleRangeChange={onVisibleRangeChange}
          />
          <button type="button" onClick={() => setFocused(new CalendarDate(2027, 3, 3))}>
            Jump
          </button>
        </>
      )
    }
    render(<Controlled />)
    act(() => screen.getByRole("button", { name: "Jump" }).click())
    expect(await cal().heading()).toBe("March 2027")
    expect(String(onVisibleRangeChange.mock.calls.at(-1)?.[0]?.start)).toBe("2027-03-01")
  })

  it("Trigger paging is announced once, keyed; keyboard paging is silent", async () => {
    installAnnouncementLog().length = 0
    render(<Cal />)
    const next = screen.getByRole("button", { name: "Next month" })
    act(() => next.click())
    act(() => next.click())
    await waitFor(
      () => expect(installAnnouncementLog().map((a) => a.message)).toEqual(["December 2026"]),
      { timeout: 4000 },
    )
    installAnnouncementLog().length = 0
    await cal().via("keyboard").nextPage()
    expect(await cal().heading()).toBe("January 2027")
    expect(installAnnouncementLog()).toEqual([])
  })

  it("A repeated next trigger behaves the same", async () => {
    render(<Cal twoTriggers />)
    const [, second] = screen.getAllByRole("button", { name: "Next month" })
    act(() => second?.click())
    expect(await cal().heading()).toBe("November 2026")
  })
})

describe("host hooks", () => {
  it("onDateSelect runs for the selected date pressed again; the value is unchanged", async () => {
    const onDateSelect = vi.fn()
    const onValueChange = vi.fn()
    render(
      <Cal
        defaultValue={new CalendarDate(2026, 10, 14)}
        onDateSelect={onDateSelect}
        onValueChange={onValueChange}
      />,
    )
    await cal().select("2026-10-14")
    expect(onValueChange).not.toHaveBeenCalled()
    expect(onDateSelect).toHaveBeenCalledTimes(1)
    expect(String(onDateSelect.mock.calls[0]?.[0])).toBe("2026-10-14")
  })

  it("invalid: the root is data-invalid with a valid value", () => {
    render(<Cal invalid defaultValue={new CalendarDate(2026, 10, 14)} />)
    const root = document.querySelector('[data-scope="calendar"][data-part="root"]')
    expect(root?.hasAttribute("data-invalid")).toBe(true)
  })
})
