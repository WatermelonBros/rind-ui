// The Calendar's range mode in Node (spec "Range Selection", "Range Preview", "Range Cancel And
// Leave", "Range Length", "Unavailable Dates In Ranges", "Range Prompts And Announcements").
import { CalendarDate, CalendarDateTime, GregorianCalendar } from "@internationalized/date"
import { describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type CalendarProps, calendarMachine } from "./calendar.machine"
import { calendarMessages } from "./calendar.messages"

const d = (m: number, day: number, y = 2026) => new CalendarDate(y, m, day)

function make(over: Partial<CalendarProps> = {}) {
  const log: Announcement[] = []
  const onValueChange = vi.fn()
  const onAnchorChange = vi.fn()
  const env = {
    announcer: {
      announce: (a: Announcement) => void log.push(a),
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  let props: CalendarProps = {
    visibleMonths: 1,
    pageBehavior: "visible",
    minValue: null,
    maxValue: null,
    locale: "en-US",
    firstDayOfWeek: "sun",
    selectionMode: "range",
    calendar: new GregorianCalendar(),
    formatLocale: "en-US",
    messages: calendarMessages,
    id: "c",
    defaultFocusedValue: d(10, 14),
    onValueChange,
    onAnchorChange,
    ...over,
  }
  const s = createService(calendarMachine, props as never, env as never)
  s.start()
  const view = () => s.view()
  const range = () => {
    const v = view().values.value as {
      start: { toString(): string }
      end: { toString(): string }
    } | null
    return v ? `${v.start.toString()}..${v.end.toString()}` : null
  }
  return {
    s,
    log,
    onValueChange,
    onAnchorChange,
    range,
    anchor: () => (view().values.anchor as CalendarDate | null)?.toString() ?? null,
    press: (date: CalendarDate) => s.send({ type: "CELL.PRESS", date, modality: "pointer" }),
    key: (move: "next-day" | "next-week") => s.send({ type: "NAVIGATE", move, composing: false }),
    enter: () => s.send({ type: "SELECT_FOCUSED", composing: false }),
    focus: () => s.send({ type: "GRID.FOCUS", modality: "keyboard" }),
    setProps: (next: Partial<CalendarProps>) => {
      props = { ...props, ...next }
      s.setProps(props as never)
    },
  }
}

describe("range selection", () => {
  it("a backward range commits once in date order", () => {
    const m = make()
    m.press(d(10, 20))
    expect(m.anchor()).toBe("2026-10-20")
    expect(m.onValueChange).not.toHaveBeenCalled()
    m.press(d(10, 10))
    expect(m.range()).toBe("2026-10-10..2026-10-20")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    expect(m.anchor()).toBeNull()
    expect(m.onAnchorChange.mock.calls.map((c) => c[0]?.toString() ?? null)).toEqual([
      "2026-10-20",
      null,
    ])
  })

  it("keyboard range: Enter, arrows, Space", () => {
    const m = make({ defaultFocusedValue: d(10, 10) })
    m.focus()
    m.enter()
    for (let i = 0; i < 4; i++) m.key("next-day")
    m.enter()
    expect(m.range()).toBe("2026-10-10..2026-10-14")
  })

  it("the same date twice is a one-day range; the next press starts a new anchor", () => {
    const m = make()
    m.press(d(10, 14))
    m.press(d(10, 14))
    expect(m.range()).toBe("2026-10-14..2026-10-14")
    m.press(d(10, 14))
    expect(m.anchor()).toBe("2026-10-14")
    expect(m.range()).toBe("2026-10-14..2026-10-14")
  })

  it("each end keeps its own type and time", () => {
    const m = make({
      defaultValue: {
        start: new CalendarDateTime(2026, 10, 1, 9, 30),
        end: new CalendarDateTime(2026, 10, 3, 18, 0),
      },
    })
    m.press(d(10, 12))
    m.press(d(10, 16))
    const v = m.onValueChange.mock.calls[0]?.[0] as {
      start: CalendarDateTime
      end: CalendarDateTime
    }
    expect(v.start.toString()).toBe("2026-10-12T09:30:00")
    expect(v.end.toString()).toBe("2026-10-16T18:00:00")
  })

  it("a parent's value (null) drops the anchor", () => {
    const m = make({ value: null })
    m.press(d(10, 12))
    expect(m.anchor()).toBe("2026-10-12")
    m.setProps({ value: { start: d(10, 1), end: d(10, 5) } })
    expect(m.anchor()).toBeNull()
  })

  it("a controlled anchor resumes a half-entered range", () => {
    const m = make({ anchor: d(10, 10) })
    m.press(d(10, 14))
    expect(m.range()).toBe("2026-10-10..2026-10-14")
  })
})

describe("cancel and leave", () => {
  it("Escape (CANCEL) clears the anchor and keeps the value", () => {
    const m = make({ defaultValue: { start: d(10, 1), end: d(10, 5) } })
    m.press(d(10, 12))
    m.s.send({ type: "CANCEL" })
    expect(m.anchor()).toBeNull()
    expect(m.range()).toBe("2026-10-01..2026-10-05")
  })

  it.each([
    ["reset", "2026-10-01..2026-10-05"],
    ["clear", null],
    ["select", "2026-10-12..2026-10-14"],
  ] as const)("leaving with commitOnBlur %s", (commitOnBlur, expected) => {
    const m = make({ commitOnBlur, defaultValue: { start: d(10, 1), end: d(10, 5) } })
    m.press(d(10, 12))
    m.s.send({ type: "CELL.HOVER", date: d(10, 14) })
    m.s.send({ type: "LEAVE" })
    expect(m.anchor()).toBeNull()
    expect(m.range()).toBe(expected)
  })

  it("paging keeps the anchor", () => {
    const m = make()
    m.press(d(10, 28))
    m.s.send({ type: "PAGE", direction: 1, modality: "pointer" })
    m.press(d(11, 3))
    expect(m.range()).toBe("2026-10-28..2026-11-03")
  })
})

describe("length and availability", () => {
  it("maxRangeLength 7: 17 October cannot end a range anchored on the 10th", () => {
    const m = make({ maxRangeLength: 7 })
    m.press(d(10, 10))
    m.press(d(10, 17))
    expect(m.range()).toBeNull()
    m.press(d(10, 16))
    expect(m.range()).toBe("2026-10-10..2026-10-16")
  })

  it("minRangeLength 3: the 11th is refused, the 12th commits", () => {
    const m = make({ minRangeLength: 3 })
    m.press(d(10, 10))
    m.press(d(10, 11))
    expect(m.range()).toBeNull()
    m.press(d(10, 12))
    expect(m.range()).toBe("2026-10-10..2026-10-12")
  })

  it("contiguous by default; non-contiguous allowed by the prop", () => {
    const isDateUnavailable = (x: CalendarDate) => x.compare(d(10, 15)) === 0
    const m = make({ isDateUnavailable })
    m.press(d(10, 12))
    m.press(d(10, 16))
    expect(m.range()).toBeNull()
    const n = make({ isDateUnavailable, allowsNonContiguousRanges: true })
    n.press(d(10, 12))
    n.press(d(10, 16))
    expect(n.range()).toBe("2026-10-12..2026-10-16")
  })

  it("isDateUnavailable is told the anchor", () => {
    const seen: (string | null)[] = []
    const m = make({
      isDateUnavailable: (_x, { anchor }) => {
        seen.push(anchor?.toString() ?? null)
        return false
      },
    })
    m.press(d(10, 1))
    m.press(d(10, 9))
    expect(seen).toContain("2026-10-01")
  })
})

describe("announcements", () => {
  it("anchor set, then range selected, keyed per instance", () => {
    const m = make()
    m.press(d(10, 10))
    m.press(d(10, 14))
    expect(m.log.map((a) => a.message)).toEqual([
      "Range starts Saturday, October 10, 2026",
      "Selected Saturday, October 10, 2026 to Wednesday, October 14, 2026",
    ])
    expect(new Set(m.log.map((a) => a.key))).toEqual(new Set(["calendar-c-range"]))
  })
})
