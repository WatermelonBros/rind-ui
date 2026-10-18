// Date Field range mode (date-field spec "Range Mode — …"): jsdom and real browsers.
import { CalendarDate, isWeekend } from "@internationalized/date"
import { type DateRangeFieldValue, domEnvironment } from "@rind-ui/core"
import { DateField, RindProvider } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fixedDateClock, getDateField } from "../index"

const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")
const d = (m: number, day: number) => new CalendarDate(2026, m, day)
afterEach(() => vi.restoreAllMocks())

type P = Parameters<typeof DateField.Root>[0] & { readonly selectionMode: "range" }
function Stay(props: Partial<P>) {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
        <DateField.Root
          selectionMode="range"
          startName="from"
          endName="to"
          locale="en-US"
          {...(props as object)}
        >
          <DateField.Label>Stay</DateField.Label>
          <DateField.Input />
          <DateField.ErrorMessage />
        </DateField.Root>
        <button type="submit">Book</button>
      </form>
    </RindProvider>
  )
}
const spin = (name: string) => screen.getByRole("spinbutton", { name })
const formData = () =>
  Object.fromEntries(new FormData(screen.getByTestId("form") as HTMLFormElement))

describe("Date Field range", () => {
  it("one group named by the Label, six spinbuttons named by end and Label", () => {
    render(<Stay />)
    const group = screen.getByRole("group", { name: "Stay" })
    expect(group.querySelectorAll('[role="spinbutton"]')).toHaveLength(6)
    expect(spin("month Start date Stay")).toBeTruthy()
    expect(spin("year End date Stay")).toBeTruthy()
    expect(screen.getAllByRole("group")).toHaveLength(1)
  })

  it("typing both ends: one change, focus moves to the end, two form values", async () => {
    const onValueChange = vi.fn()
    render(<Stay onValueChange={onValueChange} />)
    const user = userEvent.setup()
    await user.click(spin("month Start date Stay"))
    await user.keyboard("10142026")
    await waitFor(() => expect(document.activeElement).toBe(spin("month End date Stay")))
    await user.keyboard("10162026")
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1))
    const v = onValueChange.mock.calls[0]?.[0] as { start: CalendarDate; end: CalendarDate }
    expect(`${v.start}..${v.end}`).toBe("2026-10-14..2026-10-16")
    expect(formData()).toMatchObject({ from: "2026-10-14", to: "2026-10-16" })
    expect(screen.getByRole("group").getAttribute("aria-describedby")).toBeTruthy()
  })

  it("partial entry is null and submits empty strings", async () => {
    render(<Stay />)
    const user = userEvent.setup()
    await user.click(spin("month Start date Stay"))
    await user.keyboard("10142026")
    expect(formData()).toMatchObject({ from: "", to: "" })
  })

  it("an inverted range is kept as typed and invalid (zag#3186)", async () => {
    const onValueChange = vi.fn()
    render(<Stay onValueChange={onValueChange} validationMode="blur" />)
    const user = userEvent.setup()
    await user.click(spin("month Start date Stay"))
    await user.keyboard("06202026")
    await user.keyboard("06102026")
    await user.tab()
    expect(spin("day Start date Stay").getAttribute("aria-valuenow")).toBe("20")
    expect(spin("day End date Stay").getAttribute("aria-valuenow")).toBe("10")
    expect(onValueChange).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByText("End date must be on or after the start date")).toBeTruthy(),
    )
  })

  it("a range over an unavailable day is invalid", async () => {
    render(<Stay isDateUnavailable={(x) => isWeekend(x, "en-US")} validationMode="blur" />)
    const user = userEvent.setup()
    await user.click(spin("month Start date Stay"))
    await user.keyboard("10122026")
    await user.keyboard("10212026")
    await user.tab()
    await waitFor(() =>
      expect(screen.getByText("The range includes an unavailable date")).toBeTruthy(),
    )
  })

  it("Backspace in an empty first end segment goes back to the start", async () => {
    render(<Stay />)
    const user = userEvent.setup()
    await user.click(spin("month End date Stay"))
    await user.keyboard("{Backspace}")
    await waitFor(() => expect(document.activeElement).toBe(spin("year Start date Stay")))
  })

  it("a parent's null clears both ends (reka-ui#1939)", async () => {
    function Controlled() {
      const [value, setValue] = useState<DateRangeFieldValue>({ start: d(10, 1), end: d(10, 3) })
      return (
        <>
          <button type="button" onClick={() => setValue(null)}>
            Clear
          </button>
          <Stay value={value} onValueChange={setValue} />
        </>
      )
    }
    render(<Controlled />)
    expect(spin("day End date Stay").getAttribute("aria-valuenow")).toBe("3")
    await userEvent.setup().click(screen.getByRole("button", { name: "Clear" }))
    await waitFor(() => expect(spin("day End date Stay").getAttribute("aria-valuenow")).toBeNull())
    expect(spin("day Start date Stay").getAttribute("aria-valuenow")).toBeNull()
  })

  it("the range is described on the group", () => {
    render(<Stay defaultValue={{ start: d(10, 14), end: d(10, 16) }} />)
    const group = screen.getByRole("group", { name: "Stay" })
    const ids = (group.getAttribute("aria-describedby") ?? "").split(" ")
    const text = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    expect(text).toContain(
      "Selected range: Wednesday, October 14, 2026 to Friday, October 16, 2026",
    )
  })

  it("driver: fill both ends, read both hidden inputs; clear empties both", async () => {
    render(<Stay />)
    const stay = getDateField(
      screen,
      { name: "Stay", selectionMode: "range" },
      { platform: domEnvironment().platform },
    )
    await stay.fill({ start: "2026-10-12", end: "2026-10-16" })
    expect(await stay.range()).toEqual({ start: "2026-10-12", end: "2026-10-16" })
    expect(await stay.isComplete()).toBe(true)
    await stay.clear()
    await waitFor(async () => expect(await stay.range()).toEqual({ start: "", end: "" }))
    expect((await stay.segments("end")).every((x) => x.value === null)).toBe(true)
  })

  it("inside a Field: one control, no second-control warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Stay />)
    expect(warn.mock.calls.some((c) => String(c[0]).includes("second control"))).toBe(false)
  })

  it("Backspace in one segment of the start leaves the end alone (bits-ui#1348)", async () => {
    render(<Stay defaultValue={{ start: d(10, 12), end: d(10, 16) }} />)
    const user = userEvent.setup()
    await user.click(spin("day Start date Stay"))
    await user.keyboard("{Backspace}{Backspace}")
    expect(spin("day Start date Stay").getAttribute("aria-valuenow")).toBeNull()
    expect(spin("day End date Stay").getAttribute("aria-valuenow")).toBe("16")
  })
})
