// Server markup hydrates without a mismatch in Strict Mode with a fixed clock: the visible
// month and the tab stop are the same on both sides; today is marked only after hydration
// (the server's day or zone may not be the viewer's, RA#9786).
import { CalendarDate } from "@internationalized/date"
import { Calendar, RindProvider } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fixedDateClock } from "../index"

afterEach(() => vi.restoreAllMocks())

const clock = fixedDateClock("2026-10-14T12:00:00Z")

const tree = (
  <RindProvider environment={{ dateClock: clock }}>
    <Calendar.Root aria-label="Departure" defaultValue={new CalendarDate(2026, 10, 20)}>
      <Calendar.Header>
        <Calendar.PrevTrigger />
        <Calendar.Heading />
        <Calendar.NextTrigger />
      </Calendar.Header>
      <Calendar.Grid />
    </Calendar.Root>
  </RindProvider>
)

describe("Calendar hydration", () => {
  it("no mismatch; the selection and one tab stop survive; today is marked after hydration", async () => {
    const html = renderToString(tree)
    expect(html).not.toContain('aria-current="date"')
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <StrictMode>{tree}</StrictMode>, {
        onRecoverableError: (e) => error(String(e)),
      })
    })
    expect(error.mock.calls).toEqual([])
    const stops = container.querySelectorAll('[role="gridcell"][tabindex="0"]')
    expect([...stops].map((c) => c.getAttribute("data-value"))).toEqual(["2026-10-20"])
    expect(container.querySelector('[aria-current="date"]')?.getAttribute("data-value")).toBe(
      "2026-10-14",
    )
    await act(async () => root?.unmount())
    container.remove()
  })
})
