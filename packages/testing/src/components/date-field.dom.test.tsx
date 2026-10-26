// Date Field spec scenarios (add-date-field tasks 3.2, 4.2, 5.1, 6.3, A.2–A.5) through its
// driver where it can: the same tests run in jsdom and in real browsers (a fixed clock).
import {
  CalendarDate,
  CalendarDateTime,
  createCalendar,
  isWeekend,
  parseZonedDateTime,
} from "@internationalized/date"
import { domEnvironment, platforms } from "@rind-ui/core"
import { DateField, type DateFieldRootProps, Field, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useRef, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fixedDateClock, getDateField, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)
const clock = fixedDateClock("2026-10-17T12:00:00Z", "UTC")

afterEach(() => {
  vi.restoreAllMocks()
  installAnnouncementLog().length = 0
})

type DProps = DateFieldRootProps & {
  readonly label?: string
  readonly env?: Parameters<typeof RindProvider>[0]["environment"]
}
function D({ label = "Birthday", env, ...props }: DProps) {
  return (
    <RindProvider environment={{ dateClock: clock, ...env }}>
      <form onSubmit={(e) => e.preventDefault()}>
        <DateField.Root name="birthday" {...props}>
          <DateField.Label>{label}</DateField.Label>
          <DateField.Input />
          <DateField.ErrorMessage />
        </DateField.Root>
        <button type="reset">Reset</button>
        <button type="submit">Submit</button>
      </form>
    </RindProvider>
  )
}
const drv = (name = "Birthday") => getDateField(screen, { name }, { platform })
const segment = (name: string) => screen.getByRole("spinbutton", { name }) as HTMLInputElement
const hidden = () =>
  document.querySelector<HTMLInputElement>(
    '[data-scope="date-field"][data-part="hidden-input"]',
  ) as HTMLInputElement
const formData = () => new FormData(document.querySelector("form") as HTMLFormElement)

describe("Date Field", () => {
  it("Standalone field: a group named by the label, segments named by type and label", () => {
    render(<D />)
    const group = screen.getByRole("group", { name: "Birthday" })
    expect(group).toBeTruthy()
    const names = screen.getAllByRole("spinbutton").map((s) => s.getAttribute("aria-labelledby"))
    expect(names).toHaveLength(3)
    expect(segment("month Birthday")).toBeTruthy()
    expect(segment("day Birthday")).toBeTruthy()
    expect(segment("year Birthday")).toBeTruthy()
  })

  it("Same test in both environments: fill in en-GB", async () => {
    render(<D locale="en-GB" />)
    await drv().fill("1990-12-01")
    expect(await drv().value()).toBe("1990-12-01")
    const texts = (await drv().segments()).map((s) => s.text)
    expect(texts).toEqual(["01", "12", "1990"])
  })

  it("Month segment name and value; group describes the whole value", () => {
    render(<D defaultValue={new CalendarDate(2026, 10, 14)} />)
    const month = segment("month Birthday")
    expect(month.getAttribute("aria-valuenow")).toBe("10")
    expect(month.getAttribute("aria-valuetext")).toBe("10 – October")
    const group = screen.getByRole("group", { name: "Birthday" })
    const ids = group.getAttribute("aria-describedby")?.split(" ") ?? []
    const text = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
    expect(text).toContain("Selected date: Wednesday, October 14, 2026")
  })

  it("Description only on the first segment unless invalid; no roledescription", () => {
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <DateField.Root>
          <DateField.Label>Birthday</DateField.Label>
          <DateField.Description>As on your passport</DateField.Description>
          <DateField.Input />
        </DateField.Root>
      </RindProvider>,
    )
    const [first, ...rest] = screen.getAllByRole("spinbutton")
    expect(first?.getAttribute("aria-describedby")).toBeTruthy()
    for (const s of rest) expect(s.getAttribute("aria-describedby")).toBeNull()
    for (const s of screen.getAllByRole("spinbutton")) {
      expect(s.getAttribute("aria-roledescription")).toBeNull()
      expect(s.getAttribute("contenteditable")).toBeNull()
      expect(s.tagName).toBe("INPUT")
    }
    for (const lit of document.querySelectorAll('[data-type="literal"]')) {
      expect(lit.getAttribute("aria-hidden")).toBe("true")
    }
  })

  it("Typing a year emits once, with the whole date", async () => {
    const onValueChange = vi.fn()
    render(<D onValueChange={onValueChange} />)
    await drv().fill("2026-10-14")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.lastCall?.[0].toString()).toBe("2026-10-14")
    expect(onValueChange.mock.lastCall?.[1].reason).toBe("SEGMENT.COMMIT")
  })

  it("Day 31 before the month in en-GB; leading zero shown", async () => {
    render(<D locale="en-GB" />)
    await drv().typeSegment("day", "31")
    expect(segment("day Birthday").value).toBe("31")
    expect(await drv().focusedSegment()).toBe("month")
    await drv().typeSegment("month", "0")
    expect(segment("month Birthday").value).toBe("0")
    expect(await drv().focusedSegment()).toBe("month")
  })

  it("Non-numeric text rejected (bits-ui#1988)", async () => {
    render(<D />)
    await drv().typeSegment("day", "abc12")
    expect(segment("day Birthday").value).toBe("12")
  })

  it("Separator advances; Backspace back to the previous segment", async () => {
    render(<D />)
    await drv().typeSegment("month", "3/")
    expect(await drv().focusedSegment()).toBe("day")
    await drv().backspace()
    expect(await drv().focusedSegment()).toBe("month")
    expect(segment("month Birthday").value).toBe("3")
  })

  it("Steps: ArrowUp commits; Enter submits the form and changes nothing", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <form onSubmit={onSubmit}>
          <DateField.Root defaultValue={new CalendarDate(2026, 10, 14)}>
            <DateField.Label>Birthday</DateField.Label>
            <DateField.Input />
          </DateField.Root>
          <button type="submit">Submit</button>
        </form>
      </RindProvider>,
    )
    await drv().step("month", "increase")
    expect(segment("month Birthday").value).toBe("11")
    await userEvent.keyboard("{Enter}")
    expect(segment("month Birthday").value).toBe("11")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("Stale form value after clearing (react-spectrum#9801)", async () => {
    render(<D defaultValue={new CalendarDate(2026, 10, 14)} />)
    expect(formData().get("birthday")).toBe("2026-10-14")
    await drv().clearSegment("day")
    expect(formData().get("birthday")).toBe("")
    expect(segment("month Birthday").value).toBe("10")
  })

  it("Select all + Backspace clears every segment", async () => {
    render(<D defaultValue={new CalendarDate(2026, 10, 14)} />)
    await drv().step("day", "increase")
    await drv().clear()
    expect((await drv().segments()).every((s) => s.text === "")).toBe(true)
    expect(await drv().value()).toBe("")
  })

  it("Paste an ISO date into any segment; copy the whole value", async () => {
    render(<D locale="en-GB" />)
    await drv().enter()
    await drv().paste("2026-10-14")
    expect(await drv().value()).toBe("2026-10-14")
    expect((await drv().segments()).map((s) => s.text)).toEqual(["14", "10", "2026"])
    // A stub clipboard (jsdom has no DataTransfer): React reads the native event's.
    let copied = ""
    const copy = Object.assign(new Event("copy", { bubbles: true, cancelable: true }), {
      clipboardData: { setData: (_t: string, v: string) => (copied = v), getData: () => "" },
    })
    act(() => {
      segment("day Birthday").dispatchEvent(copy)
    })
    expect(copied).toBe("14/10/2026")
  })

  it("Paste the locale format: 14.10.2026 in de-DE", async () => {
    render(<D locale="de-DE" label="Datum" />)
    await drv("Datum").enter()
    await drv("Datum").paste("14.10.2026")
    expect(await drv("Datum").value()).toBe("2026-10-14")
  })

  it("Impossible date kept and reported (react-spectrum#9624)", async () => {
    render(<D />)
    await drv().fill("2026-02-31")
    await drv().leave()
    expect((await drv().segments()).map((s) => s.text)).toEqual(["02", "31", "2026"])
    expect(await drv().value()).toBe("")
    expect(await drv().validity()).toBe("impossible")
    expect(hidden().validationMessage).toBe("Enter a valid date")
  })

  it("Unavailable typed date is the value and invalid (react-spectrum#4848)", async () => {
    render(<D isDateUnavailable={(d) => isWeekend(d, "en-US")} />)
    await drv().fill("2026-10-17")
    expect(await drv().value()).toBe("2026-10-17")
    expect(hidden().validationMessage).toBe("This date is unavailable")
  })

  it("Italian validity message", async () => {
    render(<D messages={{ incomplete: "Inserisci una data completa" }} />)
    await drv().typeSegment("month", "10")
    await drv().leave()
    expect(hidden().validationMessage).toBe("Inserisci una data completa")
  })

  it("Placeholder letters are translatable (zag#3420)", () => {
    render(
      <D
        locale="de-DE"
        label="Datum"
        messages={{ placeholder: (t) => ({ year: "jjjj", month: "mm", day: "tt" })[t as "day"] }}
      />,
    )
    const placeholders = screen
      .getAllByRole("spinbutton")
      .map((s) => (s as HTMLInputElement).placeholder)
    expect(placeholders.join(".")).toBe("tt.mm.jjjj")
  })

  it("Styling the empty state", () => {
    render(<D />)
    const root = document.querySelector('[data-scope="date-field"][data-part="root"]')
    expect(root?.hasAttribute("data-placeholder-shown")).toBe(true)
    for (const s of screen.getAllByRole("spinbutton")) {
      expect(s.hasAttribute("data-placeholder")).toBe(true)
    }
  })

  it("External clear while focused (bits-ui#2174)", async () => {
    function Controlled() {
      const [v, setV] = useState<CalendarDate | null>(new CalendarDate(2026, 10, 14))
      return (
        <RindProvider environment={{ dateClock: clock }}>
          <DateField.Root value={v} onValueChange={(n) => setV(n as CalendarDate | null)}>
            <DateField.Label>Birthday</DateField.Label>
            <DateField.Input />
          </DateField.Root>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setV(null)}
          >
            Clear
          </button>
        </RindProvider>
      )
    }
    render(<Controlled />)
    await drv().typeSegment("day", "1")
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect((await drv().segments()).every((s) => s.text === "")).toBe(true)
    expect(document.activeElement).toBe(segment("day Birthday"))
  })

  it("Reset a partial field (react-spectrum#9366)", async () => {
    render(<D granularity="minute" />)
    await drv().typeSegment("hour", "9")
    await drv().resetForm()
    expect((await drv().segments()).every((s) => s.text === "")).toBe(true)
    expect(await drv().validity()).toBe("")
  })

  it("Value type from the placeholder", async () => {
    const onValueChange = vi.fn()
    render(
      <D placeholderValue={new CalendarDateTime(2026, 1, 1, 9, 0)} onValueChange={onValueChange} />,
    )
    await drv().fill("2026-10-14T09:30")
    expect(onValueChange.mock.lastCall?.[0]).toBeInstanceOf(CalendarDateTime)
  })

  it("Minute granularity in 24-hour German: no day period", () => {
    render(
      <D
        locale="de-DE"
        label="Termin"
        granularity="minute"
        placeholderValue={new CalendarDateTime(2026, 1, 1)}
      />,
    )
    const types = screen.getAllByRole("spinbutton").map((s) => s.getAttribute("data-type"))
    expect(types).toEqual(["day", "month", "year", "hour", "minute"])
  })

  it("Seconds without step mismatch (reka-ui#3000); hidden input typed by kind", () => {
    render(<D granularity="second" defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30, 15)} />)
    expect(hidden().type).toBe("datetime-local")
    expect(hidden().getAttribute("step")).toBe("1")
    expect(hidden().validity.stepMismatch).toBe(false)
  })

  it("A zoned value: text hidden input with offset and zone; zone name shown", () => {
    render(
      <D
        granularity="minute"
        defaultValue={parseZonedDateTime("2026-10-14T09:44[Europe/Lisbon]")}
      />,
    )
    expect(hidden().type).toBe("text")
    expect(hidden().value).toBe("2026-10-14T09:44:00+01:00[Europe/Lisbon]")
    expect(document.querySelector('[data-type="timeZoneName"]')).toBeTruthy()
  })

  it("Out of range blocks submission (reka-ui#2275)", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <form onSubmit={onSubmit}>
          <DateField.Root name="d" maxValue={new CalendarDate(2026, 12, 31)}>
            <DateField.Label>Birthday</DateField.Label>
            <DateField.Input />
          </DateField.Root>
          <button type="submit">Submit</button>
        </form>
      </RindProvider>,
    )
    await drv().fill("2027-01-01")
    expect(hidden().max).toBe("2026-12-31")
    expect(hidden().checkValidity()).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).not.toHaveBeenCalled()
    // Validation focuses the hidden input, which forwards focus to the first segment (jsdom
    // runs no interactive validation: the forward is what the browser triggers).
    if (inJsdom) act(() => hidden().focus())
    await vi.waitFor(() => expect(document.activeElement).toBe(segment("month Birthday")))
  })

  it("Seconds kept at minute granularity never block submission", () => {
    render(<D granularity="minute" defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30, 15)} />)
    expect(hidden().getAttribute("step")).toBe("60")
    expect(hidden().value).toBe("2026-10-14T09:30")
    expect(hidden().checkValidity()).toBe(true)
  })

  it("Read-only stays focusable (reka-ui#2007); ArrowUp changes nothing", async () => {
    render(<D readOnly defaultValue={new CalendarDate(2026, 10, 14)} />)
    await drv().enter()
    expect(document.activeElement).toBe(segment("month Birthday"))
    await drv().step(null, "increase")
    expect(segment("month Birthday").value).toBe("10")
    expect(segment("month Birthday").getAttribute("aria-readonly")).toBe("true")
  })

  it("Disabled: segments disabled, the hidden input too", () => {
    render(<D disabled defaultValue={new CalendarDate(2026, 10, 14)} />)
    for (const s of screen.getAllByRole("spinbutton"))
      expect((s as HTMLInputElement).disabled).toBe(true)
    expect(hidden().disabled).toBe(true)
    expect(screen.getByRole("group").getAttribute("aria-disabled")).toBe("true")
  })

  it("Japanese eras with createCalendar", () => {
    render(
      <D
        locale="ja-JP-u-ca-japanese"
        label="生年月日"
        createCalendar={createCalendar}
        defaultValue={new CalendarDate(2026, 10, 14)}
      />,
    )
    const types = screen.getAllByRole("spinbutton").map((s) => s.getAttribute("data-type"))
    expect(types).toEqual(["era", "year", "month", "day"])
    expect(hidden().value).toBe("2026-10-14")
  })

  it("Arabic order and isolated time (react-spectrum#4711)", () => {
    render(
      <D
        locale="ar-AE"
        label="الموعد"
        granularity="minute"
        defaultValue={new CalendarDateTime(2026, 10, 14, 9, 5)}
      />,
    )
    const expected = new Intl.DateTimeFormat("ar-AE", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
      .formatToParts(new Date(2026, 9, 14, 9, 5))
      .map((p) => p.type)
      .filter((t) => t !== "literal")
    const types = screen.getAllByRole("spinbutton").map((s) => s.getAttribute("data-type"))
    expect(types).toEqual(expected)
    const text = document.querySelector('[data-part="input"]')?.textContent ?? ""
    expect(text).toContain("⁦")
    expect(text).toContain("⁩")
  })
})

describe("Field Integration", () => {
  it("Error shown after leaving (react-spectrum#3328); moving between segments does not touch", async () => {
    render(
      <RindProvider environment={{ dateClock: clock }}>
        {/* The Field shows errors on leave in its blur mode (the default is submit). */}
        <Field.Root validationMode="blur">
          <Field.Label>Birthday</Field.Label>
          <DateField.Root>
            <DateField.Input />
          </DateField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <button type="button">Next</button>
      </RindProvider>,
    )
    const root = () => document.querySelector('[data-scope="field"][data-part="root"]')
    await drv().typeSegment("month", "02")
    expect(root()?.hasAttribute("data-touched")).toBe(false)
    await drv().typeSegment("day", "31")
    await drv().typeSegment("year", "2026")
    // Tab out of the last segment.
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Enter a valid date")).toBeTruthy()
    for (const s of screen.getAllByRole("spinbutton")) {
      expect(s.getAttribute("aria-invalid")).toBe("true")
    }
  })
})

describe("Embedded Mode (A.3)", () => {
  function Host(p: { readonly onValidity?: (f: unknown, m: string) => void }) {
    return (
      <RindProvider environment={{ dateClock: clock }}>
        <span id="host-label">Start date</span>
        <DateField.Root
          embedded
          labelledBy={["host-label"]}
          {...(p.onValidity ? { onValidityChange: p.onValidity } : {})}
        >
          <DateField.Input />
        </DateField.Root>
      </RindProvider>
    )
  }

  it("Embedded field has no Field or form footprint", () => {
    render(<Host />)
    expect(document.querySelector('[data-part="input"]')?.getAttribute("role")).toBe("presentation")
    expect(hidden()).toBeNull()
    expect(document.querySelector('[data-scope="field"]')).toBeNull()
    expect(segment("month Start date")).toBeTruthy()
  })

  it("Validity goes to the host", async () => {
    const onValidity = vi.fn()
    render(<Host onValidity={onValidity} />)
    expect(onValidity).toHaveBeenCalledTimes(1)
    const d = getDateField(screen, { name: /^month/ }, { platform })
    void d
    const month = segment("month Start date")
    await userEvent.click(month)
    await userEvent.keyboard("02312026")
    await userEvent.tab()
    expect(onValidity.mock.lastCall?.[0]).toMatchObject({ badInput: true, valid: false })
    expect(onValidity.mock.lastCall?.[1]).toBe("Enter a valid date")
  })
})

describe("Boundary, scope and draft hint (A.4, A.5)", () => {
  it("Boundary event at the last segment; Backspace in the first empty segment", async () => {
    const onBoundary = vi.fn()
    render(<D onBoundary={onBoundary} />)
    await drv().fill("2026-10-14")
    expect(onBoundary).toHaveBeenLastCalledWith({ direction: "next", reason: "advance" })
    expect(await drv().focusedSegment()).toBe("year")
    await drv().clear()
    act(() => segment("month Birthday").focus())
    await drv().backspace()
    expect(onBoundary).toHaveBeenLastCalledWith({ direction: "previous", reason: "backspace" })
  })

  browserIt("Adjacency across a scope: ArrowRight crosses to the second field", async () => {
    const onBoundary = vi.fn()
    function Pair(p: { readonly scoped: boolean }) {
      const scope = useRef<HTMLDivElement | null>(null)
      return (
        <RindProvider environment={{ dateClock: clock }}>
          <span id="from">From</span>
          <span id="to">To</span>
          <div ref={scope} style={{ display: "flex", gap: 8 }}>
            <DateField.Root
              embedded
              labelledBy={["from"]}
              onBoundary={onBoundary}
              {...(p.scoped ? { segmentScope: scope } : {})}
            >
              <DateField.Input />
            </DateField.Root>
            <DateField.Root embedded labelledBy={["to"]}>
              <DateField.Input />
            </DateField.Root>
          </div>
        </RindProvider>
      )
    }
    const { unmount } = render(<Pair scoped />)
    await userEvent.click(segment("year From"))
    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(segment("month To"))
    unmount()
    render(<Pair scoped={false} />)
    await userEvent.click(segment("year From"))
    await userEvent.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(segment("year From"))
    expect(onBoundary).toHaveBeenLastCalledWith({ direction: "next", reason: "arrow" })
  })

  it("Calendar follows the typed month and year", async () => {
    const onDraftChange = vi.fn()
    const onValueChange = vi.fn()
    render(<D onDraftChange={onDraftChange} onValueChange={onValueChange} />)
    await drv().typeSegment("month", "3/")
    await drv().typeSegment("year", "2031")
    expect(onDraftChange.mock.calls.map((c) => c[0])).toEqual([
      { year: null, month: 3, day: null },
      { year: 2031, month: 3, day: null },
    ])
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe("iOS VoiceOver spinbutton quirk (A.2)", () => {
  it("Date segment on iPhone: no spinbutton role or value attributes", () => {
    render(<D env={{ platform: platforms.ios }} defaultValue={new CalendarDate(2026, 10, 14)} />)
    const segs = document.querySelectorAll('[data-scope="date-field"][data-editable]')
    expect(segs.length).toBe(3)
    for (const s of segs) {
      expect(s.getAttribute("role")).toBeNull()
      expect(s.getAttribute("aria-valuenow")).toBeNull()
      expect(s.getAttribute("aria-valuemin")).toBeNull()
      expect(s.getAttribute("aria-valuemax")).toBeNull()
    }
  })

  it("Date segment on macOS: spinbuttons", () => {
    render(<D env={{ platform: platforms.apple }} />)
    expect(screen.getAllByRole("spinbutton")).toHaveLength(3)
  })
})

describe("Browser behaviour", () => {
  browserIt("No focus theft in Firefox (react-spectrum#10259)", async () => {
    render(
      <>
        <D />
        <label>
          Notes <input type="text" />
        </label>
      </>,
    )
    await drv().typeSegment("month", "1")
    const notes = screen.getByRole("textbox", { name: "Notes" }) as HTMLInputElement
    await userEvent.click(notes)
    await userEvent.keyboard("hello")
    expect(notes.value).toBe("hello")
    expect(document.activeElement).toBe(notes)
  })
})

describe("Field prop × control (5.1)", () => {
  const matrix = [
    { prop: "disabled", check: () => segment("month Birthday").disabled },
    { prop: "readOnly", check: () => segment("month Birthday").readOnly },
    { prop: "required", check: () => hidden().required },
    {
      prop: "invalid",
      check: () => segment("month Birthday").getAttribute("aria-invalid") === "true",
    },
  ] as const
  for (const { prop, check } of matrix) {
    for (const where of ["field", "date-field", "neither"] as const) {
      it(`${prop} on ${where}`, () => {
        const on = { [prop]: true }
        render(
          <RindProvider environment={{ dateClock: clock }}>
            <Field.Root {...(where === "field" ? on : {})}>
              <Field.Label>Birthday</Field.Label>
              <DateField.Root {...(where === "date-field" ? on : {})}>
                <DateField.Input />
              </DateField.Root>
            </Field.Root>
          </RindProvider>,
        )
        expect(check()).toBe(where !== "neither")
      })
    }
  }
})

describe("IME scenarios (7.2)", () => {
  it("Japanese full-width digits (react-spectrum#3739): １２ is month 12", async () => {
    render(<D />)
    await drv().enter()
    await drv().composeOpen("１２")
    await drv().composeEnd("１２")
    expect(segment("month Birthday").getAttribute("aria-valuenow")).toBe("12")
    expect(await drv().focusedSegment()).toBe("day")
  })

  it("Korean day period (react-spectrum#5832): 오후 is PM after the composition", async () => {
    render(
      <D
        locale="ko-KR"
        label="시간"
        granularity="minute"
        hourCycle={12}
        defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30)}
      />,
    )
    const period = screen
      .getAllByRole("spinbutton")
      .find((s) => s.getAttribute("data-type") === "dayPeriod") as HTMLInputElement
    act(() => period.focus())
    await drv("시간").composeOpen("오후")
    expect(document.activeElement).toBe(period)
    await drv("시간").composeEnd("오후")
    expect(await drv("시간").value()).toBe("2026-10-14T21:30")
  })

  it("compositions add up: １ then ２ committed apart is month 12", async () => {
    render(<D />)
    await drv().enter()
    await drv().composeOpen("１")
    await drv().composeEnd("１")
    await drv().composeOpen("２")
    await drv().composeEnd("２")
    expect(segment("month Birthday").getAttribute("aria-valuenow")).toBe("12")
  })

  it("Korean day period in two compositions (오, then 후) is PM", async () => {
    render(
      <D
        locale="ko-KR"
        label="시간"
        granularity="minute"
        hourCycle={12}
        defaultValue={new CalendarDateTime(2026, 10, 14, 9, 30)}
      />,
    )
    const period = screen
      .getAllByRole("spinbutton")
      .find((s) => s.getAttribute("data-type") === "dayPeriod") as HTMLInputElement
    act(() => period.focus())
    for (const syllable of ["오", "후"]) {
      await drv("시간").composeOpen(syllable)
      await drv("시간").composeEnd(syllable)
    }
    expect(await drv("시간").value()).toBe("2026-10-14T21:30")
  })
})
