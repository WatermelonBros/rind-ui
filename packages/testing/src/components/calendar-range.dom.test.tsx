// Calendar range mode through its driver (spec "Range Selection", "Range Preview", "Range Cancel
// And Leave", "Range Length", "Unavailable Dates In Ranges", "Range Prompts And
// Announcements", "Data Attributes"): runs in jsdom and in real browsers (a fixed clock).
import { CalendarDate } from "@internationalized/date"
import { Calendar, type CalendarRootProps, Dialog, RindProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getCalendar, installAnnouncementLog } from "../index"

const clock = { now: () => Date.parse("2026-10-14T12:00:00Z"), timeZone: () => "UTC" }
const cal = () => getCalendar(screen, { name: "Stay" })
const d = (m: number, day: number, y = 2026) => new CalendarDate(y, m, day)
const cell = (iso: string) =>
  document.querySelector<HTMLElement>(
    `[data-part="cell"][data-value="${iso}"]:not([data-outside-month])`,
  ) as HTMLElement
const attr = (iso: string, name: string) => cell(iso).hasAttribute(name)

function Range(props: Partial<CalendarRootProps>) {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <button type="button">Outside</button>
      <Calendar.Root aria-label="Stay" firstDayOfWeek="sun" selectionMode="range" {...props}>
        <Calendar.Header>
          <Calendar.PrevTrigger />
          <Calendar.Heading />
          <Calendar.NextTrigger />
        </Calendar.Header>
        {Array.from({ length: props.visibleMonths ?? 1 }, (_, m) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: months are positions
          <Calendar.Grid key={m} month={m} />
        ))}
      </Calendar.Root>
    </RindProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("Calendar range", () => {
  it("Backward range: one change, in date order", async () => {
    const onValueChange = vi.fn()
    render(<Range onValueChange={onValueChange} />)
    await cal().selectRange("2026-10-20", "2026-10-10")
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-20" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("grid").getAttribute("aria-multiselectable")).toBe("true")
  })

  it("Keyboard range: Enter, four ArrowRight, Space", async () => {
    render(<Range defaultFocusedValue={d(10, 10)} />)
    const user = userEvent.setup()
    cell("2026-10-10").focus()
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight} ")
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-14" })
  })

  it("Previous start starts a new range (zag#2388)", async () => {
    render(<Range defaultValue={{ start: d(10, 10), end: d(10, 20) }} />)
    await cal().startRange("2026-10-10")
    expect(await cal().anchor()).toBe("2026-10-10")
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-20" })
  })

  it("Programmatic clear drops the anchor (bits-ui#1068, reka-ui#1611)", async () => {
    function Controlled() {
      const [value, setValue] = useState<NonNullable<CalendarRootProps["value"]> | null>({
        start: d(10, 10),
        end: d(10, 20),
      })
      return (
        <>
          <button type="button" onClick={() => setValue(null)}>
            Clear
          </button>
          <Range value={value} onValueChange={setValue} />
        </>
      )
    }
    render(<Controlled />)
    await cal().startRange("2026-10-12")
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    await waitFor(async () => expect(await cal().range()).toBeNull())
    expect(await cal().anchor()).toBeNull()
    expect(document.querySelector('[aria-selected="true"]')).toBeNull()
  })

  it("Preview is not selection (react-spectrum#3285); backward hover (zag#2660)", async () => {
    render(<Range />)
    await cal().startRange("2026-10-10")
    fireEvent.pointerOver(cell("2026-10-14"), { pointerType: "mouse" })
    fireEvent.pointerEnter(cell("2026-10-14"), { pointerType: "mouse" })
    await waitFor(async () =>
      expect(await cal().preview()).toEqual([
        "2026-10-10",
        "2026-10-11",
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
      ]),
    )
    expect(document.querySelector('[aria-selected="true"]')).toBeNull()
    expect(attr("2026-10-14", "data-preview-end")).toBe(true)
  })

  it("Arrows move the preview", async () => {
    render(<Range defaultFocusedValue={d(10, 10)} />)
    const user = userEvent.setup()
    cell("2026-10-10").focus()
    await user.keyboard("{Enter}{ArrowDown}")
    expect((await cal().preview()).at(-1)).toBe("2026-10-17")
  })

  it("Escape cancels the anchor and is consumed; without an anchor it bubbles", async () => {
    const onKey = vi.fn()
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: a key listener above the calendar
      <div onKeyDown={(e) => onKey(e.key)}>
        <Range defaultValue={{ start: d(10, 1), end: d(10, 5) }} />
      </div>,
    )
    await cal().startRange("2026-10-12")
    await cal().cancel()
    expect(await cal().anchor()).toBeNull()
    expect(await cal().range()).toEqual({ start: "2026-10-01", end: "2026-10-05" })
    expect(onKey).not.toHaveBeenCalledWith("Escape")
    await userEvent.setup().keyboard("{Escape}")
    expect(onKey).toHaveBeenCalledWith("Escape")
  })

  it("Clicking outside cancels (react-spectrum#5709, #8850, #8287)", async () => {
    render(<Range defaultValue={{ start: d(10, 1), end: d(10, 5) }} />)
    await cal().startRange("2026-10-12")
    await userEvent.setup().click(screen.getByRole("button", { name: "Outside" }))
    expect(await cal().anchor()).toBeNull()
    expect(await cal().range()).toEqual({ start: "2026-10-01", end: "2026-10-05" })
  })

  it("Paging keeps the anchor (react-spectrum#8889)", async () => {
    // Two months paged one at a time, so both ends are visible again after paging back.
    render(<Range visibleMonths={2} pageBehavior="single" />)
    await cal().startRange("2026-10-28")
    await cal().nextPage()
    expect(await cal().isAnchored()).toBe(true)
    await cal().startRange("2026-11-03")
    await cal().previousPage()
    expect(await cal().range()).toEqual({ start: "2026-10-28", end: "2026-11-03" })
  })

  it("Escape bubbles to a dialog without an anchor", async () => {
    const onOpenChange = vi.fn()
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Dialog.Root defaultOpen onOpenChange={onOpenChange}>
          <Dialog.Content aria-label="Dates">
            <Calendar.Root aria-label="Stay" selectionMode="range">
              <Calendar.Grid />
            </Calendar.Root>
          </Dialog.Content>
        </Dialog.Root>
      </RindProvider>,
    )
    cell("2026-10-14").focus()
    await userEvent.setup().keyboard("{Escape}")
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything()))
  })

  it("At most a week: 4–16 pressable, 3 and 17 disabled", async () => {
    render(<Range maxRangeLength={7} />)
    await cal().startRange("2026-10-10")
    expect(attr("2026-10-17", "data-disabled")).toBe(true)
    expect(attr("2026-10-03", "data-disabled")).toBe(true)
    expect(attr("2026-10-04", "data-disabled")).toBe(false)
    expect(attr("2026-10-16", "data-disabled")).toBe(false)
    // The end prompt says why some ends are disabled.
    expect(document.querySelector('[data-part="prompt"]')?.textContent).toContain(
      "Ranges are at most 7 days",
    )
  })

  it("At least two nights: 9, 10, 11 disabled; 12 pressable", async () => {
    render(<Range minRangeLength={3} />)
    await cal().startRange("2026-10-10")
    for (const day of ["09", "10", "11"]) expect(attr(`2026-10-${day}`, "data-disabled")).toBe(true)
    expect(attr("2026-10-12", "data-disabled")).toBe(false)
  })

  it("Contiguous by default (react-spectrum#8854); a crossing value is invalid (#5302)", async () => {
    const isDateUnavailable = (x: CalendarDate) => x.compare(d(10, 15)) === 0
    render(<Range isDateUnavailable={isDateUnavailable} />)
    await cal().startRange("2026-10-12")
    expect(attr("2026-10-16", "data-disabled")).toBe(true)
    expect(attr("2026-10-14", "data-disabled")).toBe(false)
  })

  it("Controlled value crossing an unavailable day makes the root invalid", async () => {
    render(
      <Range
        value={{ start: d(10, 12), end: d(10, 18) }}
        isDateUnavailable={(x) => x.compare(d(10, 15)) === 0}
      />,
    )
    expect(await cal().isInvalid()).toBe(true)
  })

  it("Anchor-aware availability (react-spectrum#3311)", async () => {
    render(
      <Range
        isDateUnavailable={(x, { anchor }) =>
          anchor !== null && x.compare(anchor.add({ days: 7 })) > 0
        }
      />,
    )
    await cal().startRange("2026-10-01")
    expect(cell("2026-10-09").getAttribute("aria-disabled")).toBe("true")
    await cal().startRange("2026-10-09")
    expect(await cal().range()).toBeNull()
  })

  it("Prompt follows the phase; announcements", async () => {
    const log = installAnnouncementLog()
    render(<Range defaultFocusedValue={d(10, 10)} />)
    const user = userEvent.setup()
    cell("2026-10-10").focus()
    expect(cell("2026-10-10").getAttribute("aria-describedby")).toBeTruthy()
    const prompt = () =>
      document.getElementById(cell("2026-10-14").getAttribute("aria-describedby") ?? "")
        ?.textContent
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}")
    expect(prompt()).toBe("Press Enter to end the range starting Saturday, October 10, 2026")
    await waitFor(() =>
      expect(log.map((a) => a.message)).toContain("Range starts Saturday, October 10, 2026"),
    )
  })

  it("Names stay short (react-spectrum#6043)", () => {
    render(<Range defaultValue={{ start: d(10, 12), end: d(10, 16) }} />)
    expect(cell("2026-10-12").getAttribute("aria-label")).toBe("Monday, October 12, 2026")
  })

  it("Two months, range shown once (reka-ui#2730)", () => {
    render(<Range visibleMonths={2} defaultValue={{ start: d(10, 28), end: d(11, 3) }} />)
    const placeholders = document.querySelectorAll("[data-outside-month][data-in-range]")
    expect(placeholders).toHaveLength(0)
    for (const iso of ["2026-10-28", "2026-10-31", "2026-11-01", "2026-11-03"])
      expect(attr(iso, "data-in-range")).toBe(true)
  })

  it("Lone anchor (react-spectrum#5456)", async () => {
    render(<Range />)
    await cal().startRange("2026-10-10")
    expect(attr("2026-10-10", "data-anchor")).toBe(true)
    expect(attr("2026-10-10", "data-range-start")).toBe(false)
    expect(attr("2026-10-10", "data-range-end")).toBe(false)
  })

  it("Resuming a half-typed range through a controlled anchor", async () => {
    const onValueChange = vi.fn()
    render(<Range anchor={d(10, 10)} onValueChange={onValueChange} />)
    await cal().startRange("2026-10-14")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(String(onValueChange.mock.calls[0]?.[0].start)).toBe("2026-10-10")
  })

  it("Header select is inside (react-spectrum#3738)", async () => {
    render(
      <RindProvider environment={{ dateClock: clock }}>
        <Calendar.Root aria-label="Stay" selectionMode="range">
          <Calendar.Header>
            <select aria-label="Month" defaultValue="10">
              <option value="10">October</option>
              <option value="11">November</option>
            </select>
          </Calendar.Header>
          <Calendar.Grid />
        </Calendar.Root>
      </RindProvider>,
    )
    await cal().startRange("2026-10-12")
    const user = userEvent.setup()
    await user.selectOptions(screen.getByRole("combobox", { name: "Month" }), "11")
    expect(await cal().anchor()).toBe("2026-10-12")
  })

  it("Shadow root: a range by two clicks (react-spectrum#10330)", async () => {
    const host = document.createElement("div")
    document.body.append(host)
    const shadow = host.attachShadow({ mode: "open" })
    const mount = document.createElement("div")
    shadow.append(mount)
    const onValueChange = vi.fn()
    render(<Range onValueChange={onValueChange} />, { container: mount })
    const inShadow = (iso: string) =>
      shadow.querySelector<HTMLElement>(
        `[data-part="cell"][data-value="${iso}"]:not([data-outside-month])`,
      ) as HTMLElement
    const user = userEvent.setup()
    await user.click(inShadow("2026-10-08"))
    await user.click(inShadow("2026-10-17"))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    const v = onValueChange.mock.calls[0]?.[0] as { start: unknown; end: unknown }
    expect(`${v.start}..${v.end}`).toBe("2026-10-08..2026-10-17")
    host.remove()
  })

  it("Controlled anchor cleared by the parent: no anchor, no preview, no change", async () => {
    const onValueChange = vi.fn()
    function Controlled() {
      const [anchor, setAnchor] = useState<CalendarDate | null>(d(10, 10))
      return (
        <>
          <button type="button" onClick={() => setAnchor(null)}>
            Drop
          </button>
          <Range anchor={anchor} onAnchorChange={setAnchor} onValueChange={onValueChange} />
        </>
      )
    }
    render(<Controlled />)
    expect(attr("2026-10-10", "data-anchor")).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Drop" }))
    await waitFor(() => expect(document.querySelector("[data-anchor]")).toBeNull())
    expect(document.querySelector("[data-preview]")).toBeNull()
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("The preview clears when the pointer leaves and focus is outside the grid", async () => {
    render(<Range />)
    await cal().startRange("2026-10-10")
    fireEvent.pointerEnter(cell("2026-10-14"), { pointerType: "mouse" })
    await waitFor(async () => expect((await cal().preview()).length).toBeGreaterThan(0))
    fireEvent.pointerLeave(screen.getByRole("grid"), { pointerType: "mouse" })
    screen.getByRole("button", { name: "Next month" }).focus()
    await waitFor(async () => expect(await cal().preview()).toEqual([]))
    expect(await cal().isAnchored()).toBe(true)
  })

  it("An inline object value re-rendered by the parent keeps the anchor", async () => {
    let rerender = () => {}
    function Inline() {
      const [, setTick] = useState(0)
      rerender = () => setTick((t) => t + 1)
      return <Range value={{ start: d(10, 1), end: d(10, 5) }} />
    }
    render(<Inline />)
    await cal().startRange("2026-10-12")
    // A new object with the same days on every render (value={{ … }}): not a new value.
    act(() => rerender())
    act(() => rerender())
    expect(await cal().anchor()).toBe("2026-10-12")
  })

  it("Escape on a trigger inside the root cancels the anchor", async () => {
    render(<Range />)
    await cal().startRange("2026-10-12")
    screen.getByRole("button", { name: "Next month" }).focus()
    await userEvent.setup().keyboard("{Escape}")
    expect(await cal().isAnchored()).toBe(false)
  })

  it("Arrows move the preview while the mouse rests on a cell", async () => {
    render(<Range defaultFocusedValue={d(10, 10)} />)
    const user = userEvent.setup()
    cell("2026-10-10").focus()
    await user.keyboard("{Enter}")
    fireEvent.pointerEnter(cell("2026-10-12"), { pointerType: "mouse" })
    await waitFor(async () => expect((await cal().preview()).at(-1)).toBe("2026-10-12"))
    await user.keyboard("{ArrowDown}")
    expect((await cal().preview()).at(-1)).toBe("2026-10-17")
  })
})
