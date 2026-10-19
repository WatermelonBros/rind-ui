// Date Field time values and time ranges (date-family-consolidation 3.1, 3.2): the time field
// is a Date Field with no date segments; a time range is range mode with `Time` ends. Through
// the driver, in jsdom and in real browsers.
import { CalendarDateTime, Time } from "@internationalized/date"
import { domEnvironment } from "@rind-ui/core"
import { DateField, type DateFieldRootProps, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { fixedDateClock, getDateField } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")

function T({
  label = "Alarm",
  onSubmit,
  ...props
}: Partial<DateFieldRootProps> & {
  readonly label?: string
  readonly onSubmit?: (e: { preventDefault(): void }) => void
}) {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <form onSubmit={onSubmit ?? ((e) => e.preventDefault())}>
        <DateField.Root name="alarm" maxGranularity="hour" {...props}>
          <DateField.Label>{label}</DateField.Label>
          <DateField.Input />
        </DateField.Root>
        <button type="submit">Submit</button>
      </form>
    </RindProvider>
  )
}
const drv = (name = "Alarm") => getDateField(screen, { name }, { platform })
const segment = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement
const hidden = () =>
  document.querySelector<HTMLInputElement>(
    '[data-scope="date-field"][data-part="hidden-input"]',
  ) as HTMLInputElement
const formData = () => new FormData(document.querySelector("form") as HTMLFormElement)

describe("Date Field: time values", () => {
  it("Standalone time field: one group, hour / minute / AM/PM spinbuttons", () => {
    render(<T />)
    expect(screen.getByRole("group", { name: "Alarm" })).toBeTruthy()
    expect(screen.getAllByRole("spinbutton")).toHaveLength(3)
    expect(segment("hour Alarm")).toBeTruthy()
    expect(segment("minute Alarm")).toBeTruthy()
    expect(segment("AM/PM Alarm")).toBeTruthy()
  })

  it("Driver fills a 12-hour time: 9:05 PM, value 21:05", async () => {
    const onValueChange = vi.fn()
    render(<T onValueChange={onValueChange} />)
    await drv().fill("21:05")
    expect((await drv().segments()).map((s) => s.text)).toEqual(["9", "05", "PM"])
    expect(await drv().value()).toBe("21:05")
    expect(onValueChange.mock.lastCall?.[0]).toBeInstanceOf(Time)
  })

  it("setDayPeriod: AM to PM by its letter", async () => {
    render(<T defaultValue={new Time(9, 30)} />)
    await drv().setDayPeriod("pm")
    expect(await drv().value()).toBe("21:30")
  })

  it("Form value: type time, step by granularity, native min / max, the ISO time", () => {
    render(
      <T
        granularity="second"
        defaultValue={new Time(14, 30, 15)}
        minValue={new Time(9)}
        maxValue={new Time(18)}
      />,
    )
    const h = hidden()
    expect(h.type).toBe("time")
    expect(h.step).toBe("1")
    expect([h.min, h.max]).toEqual(["09:00", "18:00"])
    expect(h.value).toBe("14:30:15")
  })

  it("minute granularity: step 60", () => {
    render(<T defaultValue={new Time(14, 30)} />)
    expect([hidden().step, hidden().value]).toEqual(["60", "14:30"])
  })

  it("Hidden value after clearing (react-spectrum#9801)", async () => {
    render(<T hourCycle={24} defaultValue={new Time(14, 30)} />)
    expect(formData().get("alarm")).toBe("14:30")
    await drv().clearSegment("minute")
    expect(formData().get("alarm")).toBe("")
  })

  it("Minimum time blocks submission; focus on the hour", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(<T hourCycle={24} minValue={new Time(9)} onSubmit={onSubmit} />)
    await drv().fill("08:30")
    expect(hidden().value).toBe("08:30")
    expect(hidden().checkValidity()).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).not.toHaveBeenCalled()
    // jsdom runs no interactive validation: the hidden input's forward is what the browser does.
    if (inJsdom) act(() => hidden().focus())
    await vi.waitFor(() => expect(document.activeElement).toBe(segment("hour Alarm")))
  })

  it("Date kept: a date-time field without date segments edits only its time", async () => {
    const onValueChange = vi.fn()
    render(
      <T defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30)} onValueChange={onValueChange} />,
    )
    await drv().fill("10:45")
    expect(onValueChange.mock.lastCall?.[0].toString()).toBe("2026-10-14T10:45:00")
    expect(hidden().type).toBe("datetime-local")
  })

  it("Null shows placeholders (reka-ui#1791)", () => {
    const { rerender } = render(<T value={new Time(9, 30)} />)
    rerender(<T value={null} />)
    expect((screen.getAllByRole("spinbutton") as HTMLInputElement[]).map((s) => s.value)).toEqual([
      "",
      "",
      "",
    ])
  })

  it("Group description: the selected time", () => {
    render(<T defaultValue={new Time(21, 30)} />)
    const group = screen.getByRole("group", { name: "Alarm" })
    const ids = group.getAttribute("aria-describedby")?.split(" ") ?? []
    const text = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    expect(text).toMatch(/^Selected time: 9:30\sPM$/)
  })
})

function Shift(props: {
  readonly allowsOvernight?: boolean
  readonly locale?: string
  readonly hourCycle?: 12 | 24
  readonly defaultValue?: { readonly start: Time; readonly end: Time }
  readonly onValueChange?: (value: { start: Time; end: Time } | null) => void
}) {
  const { onValueChange, ...rest } = props
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <form onSubmit={(e) => e.preventDefault()}>
        <DateField.Root
          selectionMode="range"
          maxGranularity="hour"
          startName="open"
          endName="close"
          {...rest}
          // The ends are Time values (the field emits what it was given).
          onValueChange={(v) => onValueChange?.(v as { start: Time; end: Time } | null)}
        >
          <DateField.Label>Shift</DateField.Label>
          <DateField.Input />
          <DateField.ErrorMessage />
        </DateField.Root>
      </form>
    </RindProvider>
  )
}
const range = () => getDateField(screen, { name: "Shift", selectionMode: "range" }, { platform })
const description = () => {
  const ids = screen.getByRole("group", { name: "Shift" }).getAttribute("aria-describedby")
  return (ids?.split(" ") ?? []).map((id) => document.getElementById(id)?.textContent).join(" ")
}

describe("Date Field: time ranges", () => {
  it("Standalone time range: start and end time segments named per end", () => {
    render(<Shift />)
    for (const end of ["Start", "End"]) {
      for (const type of ["hour", "minute", "AM/PM"]) {
        expect(segment(`${type} ${end} time Shift`)).toBeTruthy()
      }
    }
  })

  it("Two times submitted: type time, open=09:00 and close=17:30", async () => {
    render(<Shift />)
    await range().fill({ start: "09:00", end: "17:30" })
    expect(await range().range()).toEqual({ start: "09:00", end: "17:30" })
    const data = formData()
    expect([data.get("open"), data.get("close")]).toEqual(["09:00", "17:30"])
    const types = Array.from(
      document.querySelectorAll<HTMLInputElement>('[data-part="hidden-input"]'),
    ).map((h) => [h.type, h.step])
    expect(types).toEqual([
      ["time", "60"],
      ["time", "60"],
    ])
  })

  it("Strict by default: 22:00 to 06:00 is invalid, both ends keep their text", async () => {
    const onValueChange = vi.fn()
    render(<Shift onValueChange={onValueChange} />)
    await range().fill({ start: "22:00", end: "06:00" })
    expect(await range().range()).toEqual({ start: "", end: "" })
    expect(await range().isInvalid()).toBe(true)
    expect(await range().invalidEdge()).toBe("end")
    expect((await range().segments("start")).map((s) => s.text)).toEqual(["10", "00", "PM"])
    expect((await range().segments("end")).map((s) => s.text)).toEqual(["6", "00", "AM"])
    expect(onValueChange).not.toHaveBeenCalled()
    // The pair's message is its validity element's (the Field shows it on submit).
    const start = document.querySelector<HTMLInputElement>(
      '[data-edge="start"][data-part="hidden-input"]',
    )
    expect(start?.validationMessage).toBe("End time must be after the start time")
  })

  it("Overnight allowed: the value is the two times, described as the next day", async () => {
    const onValueChange = vi.fn()
    render(<Shift allowsOvernight onValueChange={onValueChange} />)
    await range().fill({ start: "22:00", end: "06:00" })
    expect(await range().range()).toEqual({ start: "22:00", end: "06:00" })
    expect(await range().isInvalid()).toBe(false)
    const v = onValueChange.mock.lastCall?.[0]
    expect([v.start.toString(), v.end.toString()]).toEqual(["22:00:00", "06:00:00"])
    expect(description()).toContain("the next day")
  })

  it("Hour typed in a PM end (bits-ui#1985): 2:00 PM, type 1, 1:00 PM", async () => {
    render(<Shift defaultValue={{ start: new Time(9), end: new Time(14) }} />)
    await range().typeSegment("end", "hour", "1")
    await range().setDayPeriod("start", "am")
    expect((await range().segments("end")).map((s) => s.text).slice(0, 1)).toEqual(["1"])
    // The end's hour waits for a second digit: leave it to commit.
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    expect(await range().range()).toEqual({ start: "09:00", end: "13:00" })
  })

  it("Spanish day period per end (reka-ui#2956): 3:30 p. m. stays after typing 3", async () => {
    render(
      <Shift
        locale="es-ES"
        hourCycle={12}
        defaultValue={{ start: new Time(15, 30), end: new Time(18) }}
      />,
    )
    await range().typeSegment("start", "hour", "3")
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    expect(await range().range()).toEqual({ start: "15:30", end: "18:00" })
  })
})
