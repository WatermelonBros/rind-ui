// Timeline through its driver (spec timeline): an ordered list in DOM order, statuses derived
// from current with an item's own winning, status words in the titles and aria-current on a
// progress timeline only, alternate sides, the last connector, machine-readable time.
import { RindProvider, Timeline, type TimelineRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getTimeline } from "../index"

const EVENTS = ["Ordered", "Shipped", "Delivered"]

function Order(props: Partial<TimelineRootProps> & { readonly pendingLast?: boolean }) {
  const { pendingLast, ...root } = props
  return (
    <Timeline.Root aria-label="Order" {...root}>
      {EVENTS.map((title, index) => (
        <Timeline.Item
          key={title}
          index={index}
          {...(pendingLast && index === 2 ? { status: "pending" as const } : {})}
        >
          <Timeline.Indicator />
          <Timeline.Connector />
          <Timeline.Content>
            <Timeline.Title>{title}</Timeline.Title>
            <Timeline.Time dateTime="2026-10-20T09:00:00.000Z">Oct 20</Timeline.Time>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline.Root>
  )
}

function setup(node: React.ReactNode) {
  render(<RindProvider>{node}</RindProvider>)
  return getTimeline(screen, { name: "Order" })
}

describe("timeline", () => {
  it("an ordered list of events in DOM order", async () => {
    const d = setup(<Order />)
    expect(screen.getByRole("list", { name: "Order" }).tagName).toBe("OL")
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(await d.count()).toBe(3)
  })

  it("a plain log: no status words, nothing current", async () => {
    const d = setup(<Order />)
    expect(await d.titles()).toEqual(EVENTS)
    expect(await d.current()).toBe(-1)
    expect(await d.status(0)).toBe("")
  })

  it("current: statuses in the titles and aria-current (not colour alone)", async () => {
    const d = setup(<Order current={1} />)
    expect(await d.current()).toBe(1)
    expect(await d.titles()).toEqual([
      "Ordered (completed)",
      "Shipped (current)",
      "Delivered (not started)",
    ])
    expect(screen.getAllByRole("listitem")[1]?.getAttribute("aria-current")).toBe("step")
  })

  it("an item's own status wins", async () => {
    const d = setup(<Order current={1} pendingLast />)
    expect(await d.status(2)).toBe("pending")
    expect((await d.titles())[2]).toBe("Delivered (in progress)")
  })

  it("alternate sides keep the DOM order; the last connector is marked", () => {
    setup(<Order align="alternate" />)
    const items = screen.getAllByRole("listitem")
    expect(items.map((i) => i.getAttribute("data-side"))).toEqual(["start", "end", "start"])
    const connectors = document.querySelectorAll('[data-part="connector"]')
    expect([...connectors].map((c) => c.hasAttribute("data-last"))).toEqual([false, false, true])
    expect([...connectors].every((c) => c.getAttribute("aria-hidden") === "true")).toBe(true)
  })

  it("time is machine-readable", () => {
    setup(<Order />)
    expect(screen.getAllByText("Oct 20")[0]?.getAttribute("datetime")).toBe(
      "2026-10-20T09:00:00.000Z",
    )
  })
})
