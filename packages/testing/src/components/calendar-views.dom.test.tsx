// Calendar month and year views and drill-down through its driver (spec "Month And Year Views",
// "View Drill-Down", Anatomy "Month view"): runs in jsdom and in real browsers (a fixed clock).
import {
  CalendarDate,
  CalendarDateTime,
  createCalendar,
  toCalendar,
  toCalendarDate,
} from "@internationalized/date"
import type { CalendarValue, CalendarView } from "@rind-ui/core"
import { Calendar, type CalendarRootProps, Dialog, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCalendar, installAnnouncementLog } from "../index"

const clock = { now: () => Date.parse("2026-10-14T12:00:00Z"), timeZone: () => "UTC" }
const cal = (name = "Billing month") => getCalendar(screen, { name })
const d = (y: number, m: number, day = 1) => new CalendarDate(y, m, day)
const cell = (name: string) => screen.getByRole("gridcell", { name })
const at = (iso: string) =>
  document.querySelector<HTMLElement>(`[data-part="cell"][data-value="${iso}"]`) as HTMLElement
const attr = (iso: string, name: string) => at(iso).hasAttribute(name)
const texts = () => screen.getAllByRole("gridcell").map((c) => c.textContent)
const names = () => screen.getAllByRole("gridcell").map((c) => c.getAttribute("aria-label"))
const iso = (v: unknown) => String(v)
const log = () => installAnnouncementLog().map((a) => a.message)

function Cal(
  props: Partial<CalendarRootProps> & { readonly label?: string; readonly header?: boolean },
) {
  const { label = "Billing month", header = true, ...root } = props
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <button type="button">Outside</button>
      <Calendar.Root aria-label={label} {...root}>
        {header ? (
          <Calendar.Header>
            <Calendar.PrevTrigger />
            <Calendar.Heading />
            <Calendar.NextTrigger />
          </Calendar.Header>
        ) : null}
        <Calendar.Grid />
      </Calendar.Root>
    </RindProvider>
  )
}
/** A month picker: the value is chosen in the months view. */
const Months = (p: Partial<CalendarRootProps>) => <Cal minView="months" {...p} />
/** A year picker. */
const Years = (p: Partial<CalendarRootProps>) => <Cal minView="years" {...p} />

afterEach(() => vi.restoreAllMocks())

describe("Calendar month view", () => {
  it("Month view (Anatomy); Default page (months view)", async () => {
    render(<Cal view="months" />)
    expect(screen.getAllByRole("grid")).toHaveLength(1)
    expect(screen.getAllByRole("row")).toHaveLength(3)
    for (const row of screen.getAllByRole("row")) expect(row.children).toHaveLength(4)
    expect(names()[0]).toBe("January 2026")
    expect(names()[11]).toBe("December 2026")
    expect(texts()).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ])
    expect(await cal().heading()).toBe("2026")
    expect(screen.getByRole("button", { name: "Previous year" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Next year" })).toBeTruthy()
    // A fixed view: the heading is plain text, no weekday row.
    expect(document.querySelector('[data-part="view-trigger"]')).toBeNull()
    expect(document.querySelector('[data-part="grid-header"]')).toBeNull()
    expect(await cal().view()).toBe("months")
  })

  it("Same test in both environments (months view)", async () => {
    const { unmount } = render(<Months />)
    await cal().select("2027-03")
    expect(await cal().value()).toEqual(["2027-03-01"])
    unmount()
    render(<Months />)
    await cal().via("keyboard").select("2027-03")
    expect(await cal().value()).toEqual(["2027-03-01"])
  })

  it("Custom column count (months view)", () => {
    render(<Months columns={3} />)
    expect(screen.getAllByRole("row")).toHaveLength(4)
    for (const row of screen.getAllByRole("row")) expect(row.children).toHaveLength(3)
  })

  it("Day and time kept (reka-ui#2587) (months view)", async () => {
    const onValueChange = vi.fn()
    render(
      <Months
        defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30)}
        onValueChange={onValueChange}
      />,
    )
    await cal().select("2026-03")
    const v = onValueChange.mock.calls[0]?.[0]
    expect(v).toBeInstanceOf(CalendarDateTime)
    expect(iso(v)).toBe("2026-03-14T09:30:00")
  })

  it("Day clamped", async () => {
    const onValueChange = vi.fn()
    render(<Months defaultValue={d(2026, 3, 31)} onValueChange={onValueChange} />)
    await cal().select("2026-02")
    expect(iso(onValueChange.mock.calls[0]?.[0])).toBe("2026-02-28")
  })

  it("No value emits the first day (months view)", async () => {
    const onValueChange = vi.fn()
    render(<Months onValueChange={onValueChange} />)
    await cal().select("2026-06")
    const v = onValueChange.mock.calls[0]?.[0]
    expect(v).toBeInstanceOf(CalendarDate)
    expect(iso(v)).toBe("2026-06-01")
  })

  it("Same month is no change (months view)", async () => {
    const onValueChange = vi.fn()
    render(<Months defaultValue={d(2026, 10, 14)} onValueChange={onValueChange} />)
    await cal().select("2026-10")
    expect(onValueChange).not.toHaveBeenCalled()
    expect(await cal().isSelected("2026-10")).toBe(true)
  })

  it("Controlled clear (months view)", async () => {
    function Controlled() {
      const [value, setValue] = useState<CalendarValue>(d(2026, 10, 14))
      return (
        <>
          <button type="button" onClick={() => setValue(null)}>
            Clear
          </button>
          <Months value={value} onValueChange={setValue} />
        </>
      )
    }
    render(<Controlled />)
    expect(await cal().value()).toEqual(["2026-10-01"])
    act(() => screen.getByRole("button", { name: "Clear" }).click())
    await waitFor(async () => expect(await cal().value()).toEqual([]))
  })

  it("New object for the same month (reka-ui#2960) (months view)", async () => {
    function Controlled() {
      const [value, setValue] = useState<CalendarValue>(d(2026, 10, 14))
      return (
        <>
          <button type="button" onClick={() => setValue(d(2026, 10, 20))}>
            Same
          </button>
          <Months value={value} onValueChange={setValue} />
        </>
      )
    }
    render(<Controlled />)
    await cal().nextPage()
    expect(await cal().heading()).toBe("2027")
    act(() => screen.getByRole("button", { name: "Same" }).click())
    expect(await cal().heading()).toBe("2027")
  })

  it("Page follows the value (months view)", async () => {
    function Controlled() {
      const [value, setValue] = useState<CalendarValue>(null)
      const [focused, setFocused] = useState<CalendarDate>(d(2026, 10, 14))
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setValue(d(2031, 3, 1))
              setFocused(d(2031, 3, 1))
            }}
          >
            Set
          </button>
          <Months
            value={value}
            onValueChange={setValue}
            focusedValue={focused}
            onFocusChange={setFocused}
          />
        </>
      )
    }
    render(<Controlled />)
    act(() => screen.getByRole("button", { name: "Set" }).click())
    await waitFor(async () => expect(await cal().heading()).toBe("2031"))
    expect(at("2031-03-01").getAttribute("tabindex")).toBe("0")
  })

  it("Arrow across the year (APG) (months view)", async () => {
    render(<Months defaultFocusedValue={d(2026, 12)} />)
    await cal().via("keyboard").focusDate("2026-12")
    await cal().press("ArrowRight")
    expect(await cal().focusedDate()).toBe("2027-01-01")
    expect(await cal().heading()).toBe("2027")
  })

  it("Vertical moves use the column count (reka-ui#2781)", async () => {
    render(<Months columns={3} defaultFocusedValue={d(2026, 3)} />)
    await cal().via("keyboard").focusDate("2026-03")
    await cal().press("ArrowDown")
    expect(await cal().focusedDate()).toBe("2026-06-01")
  })

  it("RTL (months view)", async () => {
    render(<Months dir="rtl" />)
    await cal().via("keyboard").focusDate("2026-10")
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      )
    })
    await waitFor(async () => expect(await cal().focusedDate()).toBe("2026-11-01"))
    await cal().press("ArrowDown")
    expect(await cal().focusedDate()).toBe("2027-03-01")
  })

  it("Keyboard works in every mode (zag#2397) (months view)", async () => {
    for (const selectionMode of ["single", "range"] as const) {
      const { unmount } = render(<Months selectionMode={selectionMode} />)
      await cal().via("keyboard").focusDate("2026-10")
      const steps: [string, string][] = [
        ["ArrowRight", "2026-11-01"],
        ["ArrowLeft", "2026-10-01"],
        ["ArrowDown", "2027-02-01"],
        ["ArrowUp", "2026-10-01"],
        ["Home", "2026-01-01"],
        ["End", "2026-12-01"],
        ["PageDown", "2027-12-01"],
        ["PageUp", "2026-12-01"],
      ]
      for (const [key, want] of steps) {
        await cal().press(key as "Home")
        expect(await cal().focusedDate()).toBe(want)
      }
      await cal().press("Enter")
      await cal().press("Space")
      unmount()
    }
  })

  it("Virtual focus does not select (months view)", async () => {
    render(<Months />)
    act(() => cell("October 2026").focus())
    expect(await cal().value()).toEqual([])
    await waitFor(async () => expect(await cal().focusedDate()).toBe("2026-10-01"))
  })

  it("Bare click selects (months view); Enter and click agree (zag#2501)", async () => {
    const onValueChange = vi.fn()
    const { unmount } = render(
      <Months onValueChange={onValueChange} isMonthUnavailable={(m) => m.month === 8} />,
    )
    act(() => cell("October 2026").click())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(await cal().value()).toEqual(["2026-10-01"])
    await cal().via("keyboard").select("2026-11")
    expect(await cal().value()).toEqual(["2026-11-01"])
    // Unavailable: both do nothing.
    act(() => cell("August 2026").click())
    await cal().via("keyboard").focusDate("2026-08")
    await cal().press("Enter")
    expect(await cal().value()).toEqual(["2026-11-01"])
    unmount()
  })

  it("Max month selectable (months view)", async () => {
    render(<Months maxValue={d(2026, 10, 5)} />)
    await cal().select("2026-10")
    expect(await cal().value()).toEqual(["2026-10-01"])
    expect(await cal().isDisabled("2026-11")).toBe(true)
  })

  it("Month containing the minimum (period-navigation)", async () => {
    render(<Months minValue={d(2026, 10, 15)} />)
    expect(await cal().isDisabled("2026-10")).toBe(false)
    expect(await cal().isDisabled("2026-09")).toBe(true)
  })

  it("Minimum in the next year (bits-ui#1873)", async () => {
    render(<Months minValue={d(2027, 1, 1)} />)
    expect(await cal().heading()).toBe("2027")
    expect(await cal().focusedDate()).toBe("2027-01-01")
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
  })

  it("Unavailable is not disabled (months view)", async () => {
    const onValueChange = vi.fn()
    render(<Months isMonthUnavailable={(m) => m.month === 8} onValueChange={onValueChange} />)
    expect(attr("2026-08-01", "data-unavailable")).toBe(true)
    expect(attr("2026-08-01", "data-disabled")).toBe(false)
    await cal().via("keyboard").focusDate("2026-07")
    await cal().press("ArrowRight")
    expect(await cal().focusedDate()).toBe("2026-08-01")
    act(() => at("2026-08-01").click())
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("Disabled keeps the selection (react-spectrum#8542) (months view)", () => {
    render(<Months disabled defaultValue={d(2026, 10, 14)} />)
    expect(cell("October 2026").getAttribute("aria-selected")).toBe("true")
  })

  it("Read-only pages (months view)", async () => {
    render(<Months readOnly />)
    await cal().nextPage()
    expect(await cal().heading()).toBe("2027")
    act(() => cell("March 2027").click())
    expect(await cal().value()).toEqual([])
  })

  it("Focus lands on the gridcell (months view)", async () => {
    render(<Months />)
    await userEvent.setup().tab()
    await userEvent.setup().tab()
    await userEvent.setup().tab()
    await userEvent.setup().tab()
    await cal().via("keyboard").focusDate("2026-10")
    expect(document.activeElement?.getAttribute("role")).toBe("gridcell")
    expect(document.querySelector('[role="application"]')).toBeNull()
  })

  it("Header controls exposed (bits-ui#902) (months view)", () => {
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Calendar.Root aria-label="Billing month" minView="months">
          <Calendar.Header>
            <select aria-label="Year">
              <option>2026</option>
            </select>
          </Calendar.Header>
          <Calendar.Grid />
        </Calendar.Root>
      </RindProvider>,
    )
    expect(screen.getByRole("combobox", { name: "Year" }).closest('[aria-hidden="true"]')).toBe(
      null,
    )
  })

  it("Name and state of the current, selected month (months view)", () => {
    render(<Months defaultValue={d(2026, 10, 14)} />)
    const c = cell("October 2026")
    expect(c.getAttribute("aria-selected")).toBe("true")
    expect(c.getAttribute("aria-current")).toBe("date")
  })

  it("Locale names (months view)", () => {
    render(<Months locale="de-DE" />)
    const c = cell("Oktober 2026")
    expect(c.textContent).toBe("Okt")
  })

  it("Explicit unselected state (months view)", () => {
    render(<Months defaultValue={d(2026, 10, 14)} />)
    for (const c of screen.getAllByRole("gridcell"))
      expect(["true", "false"]).toContain(c.getAttribute("aria-selected"))
  })

  it("Trigger at the maximum keeps focus (months view)", async () => {
    render(<Months maxValue={d(2027, 6, 1)} />)
    const next = screen.getByRole("button", { name: "Next year" })
    act(() => next.focus())
    act(() => next.click())
    expect(await cal().heading()).toBe("2027")
    expect(next.getAttribute("aria-disabled")).toBe("true")
    act(() => next.click())
    expect(document.activeElement).toBe(next)
    expect(await cal().heading()).toBe("2027")
  })

  it("Trigger paging announced once (months view)", async () => {
    installAnnouncementLog().length = 0
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Dialog.Root defaultOpen>
          <Dialog.Content aria-label="Billing">
            <Calendar.Root aria-label="Billing month" minView="months">
              <Calendar.Header>
                <Calendar.Heading />
                <Calendar.NextTrigger />
              </Calendar.Header>
              <Calendar.Grid />
            </Calendar.Root>
          </Dialog.Content>
        </Dialog.Root>
      </RindProvider>,
    )
    const next = screen.getByRole("button", { name: "Next year" })
    act(() => next.focus())
    act(() => next.click())
    act(() => next.click())
    await waitFor(() => expect(log()).toEqual(["2028"]), { timeout: 4000 })
  })

  it("Keyboard paging is silent (months view)", async () => {
    render(<Months />)
    await cal().via("keyboard").focusDate("2026-10")
    installAnnouncementLog().length = 0
    await cal().press("PageDown")
    expect(await cal().heading()).toBe("2027")
    expect(log()).toEqual([])
  })

  it("Italian names (months view)", () => {
    render(<Months messages={{ next: "Anno successivo" }} />)
    expect(screen.getByRole("button", { name: "Anno successivo" })).toBeTruthy()
  })

  it("One focus ring (months view)", async () => {
    render(<Months />)
    await cal().via("keyboard").focusDate("2026-10")
    for (let i = 0; i < 10; i++) {
      await cal().press("PageDown")
      expect(document.querySelectorAll('[data-part="cell"][data-focus-visible]')).toHaveLength(1)
    }
    expect(await cal().heading()).toBe("2036")
  })

  it("Controlled focus does not steal focus (react-spectrum#9427)", async () => {
    function Controlled() {
      const [focused, setFocused] = useState(d(2026, 10, 14))
      return (
        <RindProvider environment={{ dateClock: clock }}>
          <Calendar.Root
            aria-label="Billing month"
            minView="months"
            focusedValue={focused}
            onFocusChange={setFocused}
          >
            <Calendar.Header>
              <select
                aria-label="Year"
                value={focused.year}
                onChange={(e) => setFocused(d(Number(e.target.value), 1))}
              >
                <option value={2026}>2026</option>
                <option value={2030}>2030</option>
              </select>
              <Calendar.Heading />
            </Calendar.Header>
            <Calendar.Grid />
          </Calendar.Root>
        </RindProvider>
      )
    }
    render(<Controlled />)
    const select = screen.getByRole("combobox", { name: "Year" })
    act(() => select.focus())
    fireEvent.change(select, { target: { value: "2030" } })
    await waitFor(async () => expect(await cal().heading()).toBe("2030"))
    expect(document.activeElement).toBe(select)
  })

  it("Hebrew leap year", () => {
    render(
      <Months
        locale="he-IL-u-ca-hebrew"
        createCalendar={createCalendar}
        defaultFocusedValue={toCalendar(d(2024, 1, 15), createCalendar("hebrew")) as CalendarDate}
      />,
    )
    expect(screen.getAllByRole("gridcell")).toHaveLength(13)
    expect(screen.getAllByRole("row")).toHaveLength(4)
  })
})

describe("Calendar month view ranges", () => {
  it("Range across pages (zag#2556)", async () => {
    render(
      <Months
        selectionMode="range"
        defaultValue={{ start: d(2026, 10, 1), end: d(2027, 4, 1) }}
        defaultFocusedValue={d(2027, 1)}
      />,
    )
    for (const m of ["01", "02", "03", "04"])
      expect(attr(`2027-${m}-01`, "data-in-range")).toBe(true)
    expect(attr("2027-04-01", "data-range-end")).toBe(true)
    expect(attr("2027-05-01", "data-in-range")).toBe(false)
    await cal().previousPage()
    expect(attr("2026-10-01", "data-range-start")).toBe(true)
    expect(attr("2026-11-01", "data-in-range")).toBe(true)
    expect(attr("2026-12-01", "data-in-range")).toBe(true)
    expect(attr("2026-09-01", "data-in-range")).toBe(false)
  })

  it("Backward range (months view); Range commit announced (months view)", async () => {
    const onValueChange = vi.fn()
    const { unmount } = render(<Months selectionMode="range" onValueChange={onValueChange} />)
    await cal().selectRange("2026-11", "2026-03")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    const v = onValueChange.mock.calls[0]?.[0]
    expect([iso(v.start), iso(v.end)]).toEqual(["2026-03-01", "2026-11-01"])
    unmount()
    installAnnouncementLog().length = 0
    render(<Months selectionMode="range" />)
    await cal().selectRange("2026-03", "2026-06")
    await waitFor(() => expect(log().at(-1)).toBe("Selected March 2026 to June 2026"))
  })

  it("Leaving cancels (months view)", async () => {
    render(
      <Months selectionMode="range" defaultValue={{ start: d(2026, 1, 1), end: d(2026, 3, 1) }} />,
    )
    await cal().startRange("2026-06")
    await userEvent.setup().click(screen.getByRole("button", { name: "Outside" }))
    expect(await cal().isAnchored()).toBe(false)
    expect(await cal().range()).toEqual({ start: "2026-01-01", end: "2026-03-01" })
  })

  it("Paging keeps the anchor (react-spectrum#8889) (months view)", async () => {
    const onValueChange = vi.fn()
    render(<Months selectionMode="range" onValueChange={onValueChange} />)
    await cal().startRange("2026-11")
    await cal().nextPage()
    expect(await cal().isAnchored()).toBe(true)
    await cal().startRange("2027-02")
    const v = onValueChange.mock.calls[0]?.[0]
    expect([iso(v.start), iso(v.end)]).toEqual(["2026-11-01", "2027-02-01"])
  })

  it("Hover never pages (zag#3084); Preview is not selection (months view)", async () => {
    render(<Months selectionMode="range" />)
    await cal().startRange("2026-03")
    const c = at("2026-10-01")
    fireEvent.pointerOver(c, { pointerType: "mouse" })
    fireEvent.pointerEnter(c, { pointerType: "mouse" })
    await waitFor(async () =>
      expect(await cal().preview()).toEqual([
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
        "2026-09-01",
        "2026-10-01",
      ]),
    )
    expect(await cal().heading()).toBe("2026")
    for (const m of ["04", "10"])
      expect(at(`2026-${m}-01`).getAttribute("aria-selected")).toBe("false")
  })

  it("Anchor is not a range end (react-spectrum#5456) (months view)", async () => {
    render(<Months selectionMode="range" />)
    await cal().startRange("2026-05")
    expect(attr("2026-05-01", "data-anchor")).toBe(true)
    expect(attr("2026-05-01", "data-range-end")).toBe(false)
    expect(document.querySelector("[data-selection-end]")).toBeNull()
  })
})

describe("Calendar year view", () => {
  it("Default page (years view)", async () => {
    render(<Years />)
    expect(await cal().heading()).toBe("2016 – 2027")
    expect(screen.getAllByRole("row")).toHaveLength(3)
    expect(texts()[0]).toBe("2016")
    expect(texts()[11]).toBe("2027")
    expect(at("2026-01-01").getAttribute("tabindex")).toBe("0")
    expect(screen.getByRole("button", { name: "Next years" })).toBeTruthy()
  })

  it("Ten years per page (years view)", async () => {
    render(<Years yearsPerPage={10} columns={5} />)
    expect(await cal().heading()).toBe("2020 – 2029")
    expect(screen.getAllByRole("row")).toHaveLength(2)
    for (const row of screen.getAllByRole("row")) expect(row.children).toHaveLength(5)
  })

  it("Month, day and time kept (reka-ui#2588) (years view)", async () => {
    const onValueChange = vi.fn()
    render(
      <Years
        defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30)}
        onValueChange={onValueChange}
      />,
    )
    await cal().select("2031")
    expect(iso(onValueChange.mock.calls[0]?.[0])).toBe("2031-10-14T09:30:00")
  })

  it("Day and time kept across views (reka-ui#2587, reka-ui#2588)", async () => {
    const onValueChange = vi.fn()
    function Both() {
      const [value, setValue] = useState<CalendarValue>(new CalendarDateTime(2026, 10, 14, 9, 30))
      return (
        <>
          <Cal
            label="Month"
            minView="months"
            maxView="months"
            value={value}
            onValueChange={(v) => {
              onValueChange(v)
              setValue(v)
            }}
          />
          <Cal
            label="Year"
            minView="years"
            value={value}
            onValueChange={(v) => {
              onValueChange(v)
              setValue(v)
            }}
          />
        </>
      )
    }
    render(<Both />)
    await cal("Month").select("2026-03")
    await cal("Year").select("2031")
    expect(onValueChange.mock.calls.map((c) => iso(c[0]))).toEqual([
      "2026-03-14T09:30:00",
      "2031-03-14T09:30:00",
    ])
  })

  it("Leap day (years view)", async () => {
    const onValueChange = vi.fn()
    render(<Years defaultValue={d(2028, 2, 29)} onValueChange={onValueChange} />)
    await cal().select("2029")
    expect(iso(onValueChange.mock.calls[0]?.[0])).toBe("2029-02-28")
  })

  it("Paging keeps the position (zag#1906)", async () => {
    render(<Years defaultFocusedValue={d(2021, 1)} />)
    await cal().via("keyboard").focusDate("2021")
    await cal().press("PageDown")
    expect(await cal().focusedDate()).toBe("2033-01-01")
    expect(await cal().heading()).toBe("2028 – 2039")
  })

  it("Fixed year pages (period-navigation)", async () => {
    render(<Years />)
    await cal().nextPage()
    expect(await cal().heading()).toBe("2028 – 2039")
    await cal().previousPage()
    expect(await cal().heading()).toBe("2016 – 2027")
  })

  it("Both years selectable (zag#2153)", async () => {
    render(<Years minValue={d(2025, 12, 15)} maxValue={d(2026, 2, 20)} />)
    expect(await cal().isDisabled("2025")).toBe(false)
    expect(await cal().isDisabled("2026")).toBe(false)
    expect(await cal().isDisabled("2024")).toBe(true)
    expect(await cal().isDisabled("2027")).toBe(true)
    await cal().select("2025")
    expect(await cal().value()).toEqual(["2025-01-01"])
  })

  it("Years outside the first page are reachable (zag#3336)", async () => {
    render(<Years />)
    await cal().nextPage()
    expect(document.querySelector('[data-part="cell"][data-disabled]')).toBeNull()
  })

  it("Page change announced (years view)", async () => {
    render(<Years />)
    const next = screen.getByRole("button", { name: "Next years" })
    act(() => next.focus())
    installAnnouncementLog().length = 0
    act(() => next.click())
    await waitFor(() => expect(log()).toEqual(["2028 – 2039"]), { timeout: 4000 })
  })

  it("BC years (years view)", async () => {
    const onValueChange = vi.fn()
    render(
      <Years defaultFocusedValue={new CalendarDate("BC", 3, 1, 1)} onValueChange={onValueChange} />,
    )
    // Gregorian year -2 is 3 BC; its page is 1 BC – 11 BC.
    expect(names()).toContain("3 BC")
    expect(names()).toContain("8 BC")
    act(() => cell("3 BC").click())
    const v = onValueChange.mock.calls[0]?.[0] as CalendarDate
    expect(v.era).toBe("BC")
    expect(v.year).toBe(3)
  })

  it("Buddhist years", () => {
    render(<Years locale="th-TH" createCalendar={createCalendar} />)
    const c = at("2026-01-01")
    expect(c.textContent).toBe("2569")
  })
})

describe("Calendar view drill-down", () => {
  it("Day to year and back", async () => {
    const onValueChange = vi.fn()
    const onViewChange = vi.fn()
    render(
      <Cal
        label="Departure"
        defaultFocusedValue={d(2026, 10, 14)}
        onValueChange={onValueChange}
        onViewChange={onViewChange}
      />,
    )
    const c = cal("Departure")
    expect(screen.getByRole("button", { name: "October 2026, Choose month" })).toBeTruthy()
    await c.viewUp()
    expect(await c.view()).toBe("months")
    expect(document.activeElement?.getAttribute("data-value")).toBe("2026-10-01")
    await c.viewUp()
    expect(await c.view()).toBe("years")
    expect(screen.getByRole("heading").textContent).toBe("2016 – 2027")
    await c.select("2031")
    expect(await c.view()).toBe("months")
    expect(await c.focusedDate()).toBe("2031-01-01")
    await c.select("2031-03")
    expect(await c.view()).toBe("days")
    expect(await c.heading()).toBe("March 2031")
    expect(onValueChange).not.toHaveBeenCalled()
    await c.select("2031-03-05")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onViewChange.mock.calls.map((x) => [x[0], x[1].reason])).toEqual([
      ["months", "heading"],
      ["years", "heading"],
      ["months", "select"],
      ["days", "select"],
    ])
  })

  it("A view change is announced with the new heading", async () => {
    render(<Cal label="Departure" />)
    installAnnouncementLog().length = 0
    await cal("Departure").viewUp()
    await waitFor(() => expect(log()).toEqual(["2026"]))
  })

  it("Month picker", async () => {
    const onValueChange = vi.fn()
    render(<Cal minView="months" defaultView="months" onValueChange={onValueChange} />)
    await cal().select("2026-03")
    expect(onValueChange.mock.calls[0]?.[0]?.month).toBe(3)
    expect(await cal().view()).toBe("months")
  })

  it("Escape goes down; at minView it bubbles", async () => {
    const onKey = vi.fn()
    function Picker() {
      const [view, setView] = useState<CalendarView>("years")
      return (
        // biome-ignore lint/a11y/noStaticElementInteractions: a key listener above the calendar
        <div onKeyDown={(e) => onKey(e.key)}>
          <Cal label="Departure" view={view} onViewChange={setView} />
        </div>
      )
    }
    render(<Picker />)
    await cal("Departure").viewDown()
    expect(await cal("Departure").view()).toBe("months")
    expect(onKey).not.toHaveBeenCalledWith("Escape")
    await cal("Departure").viewDown()
    expect(await cal("Departure").view()).toBe("days")
    await userEvent.setup().keyboard("{Escape}")
    expect(onKey).toHaveBeenCalledWith("Escape")
  })

  it("Escape goes down inside a picker (the dialog stays open)", async () => {
    const onOpenChange = vi.fn()
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
          <Dialog.Content aria-label="Dates">
            <Calendar.Root aria-label="Departure" defaultView="years">
              <Calendar.Header>
                <Calendar.Heading />
              </Calendar.Header>
              <Calendar.Grid />
            </Calendar.Root>
          </Dialog.Content>
        </Dialog.Root>
      </RindProvider>,
    )
    at("2026-01-01").focus()
    await userEvent.setup().keyboard("{Escape}")
    expect(await cal("Departure").view()).toBe("months")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('A fixed view selects there (view="months", no minView)', async () => {
    const onValueChange = vi.fn()
    render(<Cal view="months" onValueChange={onValueChange} />)
    act(() => cell("March 2026").click())
    expect(iso(onValueChange.mock.calls[0]?.[0])).toBe("2026-03-01")
    expect(await cal().view()).toBe("months")
    await cal().via("keyboard").focusDate("2026-05")
    await cal().press("Enter")
    expect(iso(onValueChange.mock.calls[1]?.[0])).toBe("2026-05-01")
    expect(await cal().view()).toBe("months")
  })

  it("A valid day range stays valid in the months and years views", async () => {
    render(
      <Cal
        label="Stay"
        selectionMode="range"
        minRangeLength={3}
        defaultValue={{ start: d(2026, 10, 1), end: d(2026, 10, 5) }}
      />,
    )
    const c = cal("Stay")
    expect(await c.isInvalid()).toBe(false)
    await c.startRange("2026-10-20")
    for (const view of ["months", "years"]) {
      await c.viewUp()
      expect(await c.view()).toBe(view)
      expect(await c.isInvalid()).toBe(false)
      expect(document.querySelector('[data-part="cell"][aria-invalid]')).toBeNull()
      expect(document.querySelector('[data-part="cell"][data-disabled]')).toBeNull()
      expect(document.querySelector('[data-part="cell"][data-preview]')).toBeNull()
    }
  })

  it("maxView bounds the heading; a fixed view's heading is text", () => {
    const { unmount } = render(<Cal label="Departure" maxView="days" />)
    expect(document.querySelector('[data-part="view-trigger"]')).toBeNull()
    unmount()
    render(<Cal label="Departure" view="days" />)
    expect(document.querySelector('[data-part="view-trigger"]')).toBeNull()
  })

  it("Single, multiple and range keep working after a round trip", async () => {
    for (const selectionMode of ["single", "multiple", "range"] as const) {
      const { unmount } = render(<Cal label="Departure" selectionMode={selectionMode} />)
      const c = cal("Departure")
      await c.viewUp()
      await c.select("2026-11")
      if (selectionMode === "range") {
        await c.selectRange("2026-11-03", "2026-11-05")
        expect(await c.range()).toEqual({ start: "2026-11-03", end: "2026-11-05" })
      } else {
        await c.select("2026-11-03")
        expect(await c.value()).toEqual(["2026-11-03"])
      }
      unmount()
    }
    void toCalendarDate
  })
})
