import { describe, expect, it } from "vitest"
import { type TimelineConnectInput, timelineConnect } from "./timeline.connect"
import { timelineContract } from "./timeline.contract"
import { timelineMessages } from "./timeline.messages"
import { timelineMeta } from "./timeline.meta"

const input = (over: Partial<TimelineConnectInput> = {}): TimelineConnectInput => ({
  instance: "t",
  orientation: "vertical",
  align: "start",
  count: 3,
  messages: timelineMessages,
  ...over,
})

describe("timeline connect", () => {
  it("current derives the statuses; an item's own status wins", () => {
    const a = timelineConnect(input({ current: 1 }))
    expect([0, 1, 2].map((index) => a.statusOf({ index }))).toEqual([
      "completed",
      "current",
      "upcoming",
    ])
    expect(a.statusOf({ index: 2, status: "pending" })).toBe("pending")
    expect(a.item({ index: 1 })["aria-current"]).toBe("step")
    expect(a.item({ index: 0 })["aria-current"]).toBeUndefined()
  })

  it("status text on a progress timeline only", () => {
    const a = timelineConnect(input({ current: 1 }))
    expect(a.statusText({ index: 0 })).toBe(" (completed)")
    expect(a.statusText({ index: 2 })).toBe(" (not started)")
    expect(a.statusText({ index: 2, status: "pending" })).toBe(" (in progress)")
    const log = timelineConnect(input())
    expect(log.statusText({ index: 0 })).toBe("")
    expect(log.item({ index: 0 })["data-status"]).toBeUndefined()
  })

  it("alternate sides by index; the last connector is marked", () => {
    const a = timelineConnect(input({ align: "alternate" }))
    expect([0, 1, 2].map((index) => a.item({ index })["data-side"])).toEqual([
      "start",
      "end",
      "start",
    ])
    expect(a.connector({ index: 2 })["data-last"]).toBe("")
    expect(a.connector({ index: 1 })["data-last"]).toBeUndefined()
  })
})

describe("timeline meta matches the code", () => {
  it("contract and data attributes", () => {
    expect(timelineMeta.contract.queries).toEqual(Object.keys(timelineContract.queries))
    const a = timelineConnect(input({ current: 0 }))
    const last = { index: 2 }
    const parts = {
      root: a.root(),
      item: a.item(last),
      indicator: a.indicator(last),
      connector: a.connector(last),
      content: a.content(last),
      title: a.title(last),
      description: a.description(last),
      time: a.time("2026-10-20"),
      opposite: a.opposite(last),
    }
    for (const [name, props] of Object.entries(parts)) {
      const keys = Object.keys(props)
        .filter((k) => k.startsWith("data-") && props[k] !== undefined)
        .sort()
      const meta = timelineMeta.dataAttributes[name as keyof typeof timelineMeta.dataAttributes]
      expect(Object.keys(meta).sort(), name).toEqual(keys)
    }
  })
})
