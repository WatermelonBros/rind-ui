// Calendar drag selection in real browsers (spec "Drag Selection", "Data Attributes"): pointer
// events at the cells' real positions (hit testing needs layout), the touch delay on a virtual
// clock, no fixed waits.
import { CalendarDate } from "@internationalized/date"
import { Calendar, type CalendarRootProps, RindProvider } from "@rind-ui/react"
import { act, render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { domEnv, getCalendar, installAnnouncementLog, virtualClock } from "../index"

const dateClock = { now: () => Date.parse("2026-10-14T12:00:00Z"), timeZone: () => "UTC" }
const d = (m: number, day: number) => new CalendarDate(2026, m, day)
const cell = (iso: string) =>
  document.querySelector<HTMLElement>(
    `[data-part="cell"][data-value="${iso}"]:not([data-outside-month])`,
  ) as HTMLElement
const root = () => document.querySelector<HTMLElement>('[data-part="root"]') as HTMLElement
const has = (iso: string, name: string) => cell(iso).hasAttribute(name)

function setup(props: Partial<CalendarRootProps> = {}) {
  const clock = virtualClock()
  render(
    <RindProvider environment={{ dateClock, scheduler: clock.scheduler }}>
      <Calendar.Root
        aria-label="Stay"
        firstDayOfWeek="sun"
        selectionMode="range"
        defaultFocusedValue={d(10, 14)}
        {...props}
      >
        <Calendar.Header>
          <Calendar.PrevTrigger />
          <Calendar.Heading />
          <Calendar.NextTrigger />
        </Calendar.Header>
        <Calendar.Grid />
      </Calendar.Root>
    </RindProvider>,
  )
  const target = domEnv({ advanceClock: (ms) => clock.advance(ms) })
  return {
    clock,
    cal: (modality: "pointer" | "touch" = "pointer") =>
      getCalendar(target, { name: "Stay" }, { modality }),
  }
}

/** A pointer event at a point (on whatever is there), as a browser dispatches it. */
function pointer(type: string, at: { x: number; y: number }, pointerType = "mouse") {
  const el = document.elementFromPoint(at.x, at.y) ?? document.body
  return act(() => {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: pointerType === "mouse" ? 1 : 2,
        pointerType,
        isPrimary: true,
        clientX: at.x,
        clientY: at.y,
        button: type === "pointermove" ? -1 : 0,
        buttons: type === "pointerup" ? 0 : 1,
        // A real contact (no pressure reads as an assistive technology's pointer).
        pressure: type === "pointerup" ? 0 : 0.5,
        width: 1,
        height: 1,
      }),
    )
  })
}
const centre = (iso: string) => {
  const r = cell(iso).getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
/** Far right of the grid, outside the Calendar. */
const outside = () => {
  const r = root().getBoundingClientRect()
  return { x: r.right + 40, y: r.top + r.height / 2 }
}

describe("Calendar drag selection", () => {
  it("Mouse drag: press 10, move over 11-14, release on 14: one change, announced", async () => {
    const log = installAnnouncementLog()
    const onValueChange = vi.fn()
    const { cal, clock } = setup({ onValueChange })
    await cal().dragRange("2026-10-10", "2026-10-14")
    // The announcer's own delay runs on the virtual clock.
    await act(() => clock.advance(1000))
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-14" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: "DRAG", modality: "pointer" })
    await waitFor(() =>
      expect(log.map((a) => a.message)).toContain(
        "Selected Saturday, October 10, 2026 to Wednesday, October 14, 2026",
      ),
    )
  })

  it("The preview follows the pointer; data-dragging while it lasts", async () => {
    setup()
    await pointer("pointerdown", centre("2026-10-10"))
    expect(root().hasAttribute("data-dragging")).toBe(true)
    expect(has("2026-10-10", "data-anchor")).toBe(true)
    await pointer("pointermove", centre("2026-10-12"))
    await pointer("pointermove", centre("2026-10-13"))
    for (const day of ["10", "11", "12", "13"])
      expect(has(`2026-10-${day}`, "data-preview")).toBe(true)
    expect(has("2026-10-14", "data-preview")).toBe(false)
    await pointer("pointerup", centre("2026-10-13"))
    expect(root().hasAttribute("data-dragging")).toBe(false)
  })

  it("A release on the anchor keeps the anchor (a click starts a range)", async () => {
    const onValueChange = vi.fn()
    const { cal } = setup({ onValueChange })
    await pointer("pointerdown", centre("2026-10-10"))
    await pointer("pointermove", centre("2026-10-12"))
    await pointer("pointermove", centre("2026-10-10"))
    await pointer("pointerup", centre("2026-10-10"))
    await act(() => cell("2026-10-10").click())
    expect(await cal().anchor()).toBe("2026-10-10")
    expect(onValueChange).not.toHaveBeenCalled()
    await cell("2026-10-12").click()
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-12" })
  })

  it("Out of the grid the last date is kept; the release outside commits it", async () => {
    const { cal } = setup()
    await pointer("pointerdown", centre("2026-10-10"))
    await pointer("pointermove", centre("2026-10-13"))
    await pointer("pointermove", outside())
    expect(has("2026-10-13", "data-preview-end")).toBe(true)
    await pointer("pointerup", outside())
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-13" })
  })

  it("Escape during a drag cancels it; the release then changes nothing", async () => {
    const onValueChange = vi.fn()
    const { cal } = setup({ onValueChange })
    await pointer("pointerdown", centre("2026-10-10"))
    await pointer("pointermove", centre("2026-10-12"))
    await act(() => {
      ;(document.activeElement ?? root()).dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      )
    })
    expect(await cal().isAnchored()).toBe(false)
    expect(root().hasAttribute("data-dragging")).toBe(false)
    await pointer("pointerup", centre("2026-10-12"))
    expect(await cal().isAnchored()).toBe(false)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("Disabled and unavailable dates: no drag from them, no end on them", async () => {
    const { cal } = setup({
      minValue: d(10, 5),
      isDateUnavailable: (date) => date.day === 15,
    })
    // Unavailable and out of range: a press there anchors nothing.
    await pointer("pointerdown", centre("2026-10-15"))
    await pointer("pointerup", centre("2026-10-15"))
    await pointer("pointerdown", centre("2026-10-03"))
    await pointer("pointerup", centre("2026-10-03"))
    expect(await cal().isAnchored()).toBe(false)
    // A range may not cross 15: 20 is disabled while anchored on 10, so the drag keeps 12.
    await pointer("pointerdown", centre("2026-10-10"))
    await pointer("pointermove", centre("2026-10-12"))
    await pointer("pointermove", centre("2026-10-20"))
    expect(has("2026-10-12", "data-preview-end")).toBe(true)
    await pointer("pointerup", centre("2026-10-20"))
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-12" })
  })

  it("Touch: held still for dragDelay, it drags; the page does not scroll meanwhile", async () => {
    const { cal, clock } = setup()
    await cal("touch").dragRange("2026-10-10", "2026-10-14")
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-14" })
    expect(clock.fired()).toBeGreaterThan(0)
    // While dragging, touchmove is prevented (no scroll); afterwards it is not.
    await pointer("pointerdown", centre("2026-10-20"), "touch")
    await act(() => clock.advance(200))
    const move = () => {
      const e = new Event("touchmove", { bubbles: true, cancelable: true })
      cell("2026-10-20").dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(move()).toBe(true)
    await pointer("pointerup", centre("2026-10-20"), "touch")
    expect(move()).toBe(false)
  })

  it("Touch scroll does not select (react-spectrum#5975)", async () => {
    const onValueChange = vi.fn()
    const { cal, clock } = setup({ onValueChange })
    const at = centre("2026-10-10")
    await pointer("pointerdown", at, "touch")
    await pointer("pointermove", { x: at.x, y: at.y + 30 }, "touch")
    // The browser takes the touch for scrolling.
    await pointer("pointercancel", { x: at.x, y: at.y + 30 }, "touch")
    await act(() => clock.advance(500))
    expect(await cal().isAnchored()).toBe(false)
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("Touch: a tap before the delay is a press", async () => {
    const { cal, clock } = setup()
    await pointer("pointerdown", centre("2026-10-10"), "touch")
    await pointer("pointerup", centre("2026-10-10"), "touch")
    // No click follows a touch here: the press delivers its activation after a frame's wait.
    await act(() => clock.advance(250))
    expect(await cal().anchor()).toBe("2026-10-10")
    expect(root().hasAttribute("data-dragging")).toBe(false)
  })

  it("Screen-reader press: two bare clicks select the range", async () => {
    const { cal } = setup()
    await act(() => cell("2026-10-10").click())
    await act(() => cell("2026-10-14").click())
    expect(await cal().range()).toEqual({ start: "2026-10-10", end: "2026-10-14" })
  })
})
