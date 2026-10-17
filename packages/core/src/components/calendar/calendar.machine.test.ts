// The Calendar machine in Node (tasks 3.2): selection, focus never selects, unavailable
// no-ops, same-day controlled values, controlled focus, clamping, announcements from idle,
// read-only. A recording announcer; no DOM.
import {
  CalendarDate,
  CalendarDateTime,
  GregorianCalendar,
  isWeekend,
} from "@internationalized/date"
import { describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { type CalendarProps, calendarMachine } from "./calendar.machine"
import { calendarMessages } from "./calendar.messages"

const d = (y: number, m: number, day: number) => new CalendarDate(y, m, day)

function make(over: Partial<CalendarProps> = {}) {
  const log: Announcement[] = []
  const onValueChange = vi.fn()
  const focusCell = vi.fn()
  const env = {
    announcer: {
      announce: (a: Announcement) => void log.push(a),
      prepare: () => () => {},
      cancel: () => {},
    },
  }
  const props: CalendarProps = {
    visibleMonths: 1,
    pageBehavior: "visible",
    minValue: null,
    maxValue: null,
    locale: "en-US",
    firstDayOfWeek: "sun",
    selectionMode: "single",
    calendar: new GregorianCalendar(),
    formatLocale: "en-US",
    messages: calendarMessages,
    id: "c",
    defaultFocusedValue: d(2026, 10, 14),
    onValueChange,
    focusCell,
    ...over,
  }
  const s = createService(calendarMachine, props as never, env as never)
  s.start()
  const view = () => s.view()
  return {
    s,
    log,
    props,
    onValueChange,
    focusCell,
    value: () => view().values.value,
    focused: () => view().values.focusedValue.toString(),
    visible: () => view().context.visibleStart.toString(),
    state: () => s.getSnapshot().state,
    focus: () => s.send({ type: "GRID.FOCUS", modality: "keyboard" }),
    press: (date: CalendarDate) => s.send({ type: "CELL.PRESS", date, modality: "pointer" }),
    key: (move: Parameters<typeof s.send>[0] extends never ? never : string) =>
      s.send({ type: "NAVIGATE", move: move as never, composing: false }),
    enter: () => s.send({ type: "SELECT_FOCUSED", composing: false }),
  }
}

describe("selection", () => {
  it("a click selects once; pressing the selected date again keeps it", () => {
    const m = make()
    m.press(d(2026, 10, 20))
    expect(String(m.value())).toBe("2026-10-20")
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
    m.press(d(2026, 10, 20))
    expect(m.onValueChange).toHaveBeenCalledTimes(1)
  })

  it("multiple toggles and stays sorted", () => {
    const m = make({ selectionMode: "multiple" })
    m.press(d(2026, 10, 10))
    m.press(d(2026, 10, 3))
    expect((m.value() as CalendarDate[]).map(String)).toEqual(["2026-10-03", "2026-10-10"])
    m.press(d(2026, 10, 3))
    expect((m.value() as CalendarDate[]).map(String)).toEqual(["2026-10-10"])
  })

  it("focus alone never selects (cause C)", () => {
    const m = make()
    m.focus()
    m.s.send({ type: "CELL.FOCUS", date: d(2026, 10, 21), modality: "virtual" })
    expect(m.value()).toBe(null)
    expect(m.focused()).toBe("2026-10-21")
  })

  it("Enter on an unavailable date does nothing (react-spectrum#5692)", () => {
    const m = make({ isDateUnavailable: (date) => isWeekend(date, "en-US") })
    m.focus()
    m.s.send({ type: "CELL.FOCUS", date: d(2026, 10, 17), modality: "keyboard" })
    m.enter()
    expect(m.value()).toBe(null)
  })

  it("the time of day is kept (bits-ui#1358)", () => {
    const m = make({ defaultValue: new CalendarDateTime(2026, 10, 14, 9, 30) })
    m.press(d(2026, 10, 20))
    expect(String(m.value())).toBe("2026-10-20T09:30:00")
  })

  it("read-only: navigation works, the value does not change", () => {
    const m = make({ readOnly: true })
    m.focus()
    m.key("next-day")
    m.enter()
    expect(m.focused()).toBe("2026-10-15")
    expect(m.value()).toBe(null)
  })
})

describe("focus and visible range", () => {
  it("keyboard moves request the cell's focus and cross months", () => {
    const m = make({ defaultFocusedValue: d(2026, 10, 31) })
    m.focus()
    m.key("next-day")
    expect(m.focused()).toBe("2026-11-01")
    expect(m.visible()).toBe("2026-11-01")
    expect(m.focusCell.mock.lastCall?.[0]).toEqual(d(2026, 11, 1))
  })

  it("a parent's focusedValue pages and announces from outside the grid", () => {
    const m = make({ focusedValue: d(2026, 10, 14) })
    m.s.setProps({ ...m.props, focusedValue: d(2027, 3, 3) } as never)
    expect(m.visible()).toBe("2027-03-01")
    expect(m.log.map((a) => a.message)).toEqual(["March 2027"])
  })

  it("a same-day controlled value keeps the visible month (reka-ui#2960)", () => {
    const m = make({ value: d(2026, 10, 14) })
    m.s.send({ type: "PAGE", direction: 1, modality: "pointer" })
    expect(m.visible()).toBe("2026-11-01")
    m.s.setProps({ ...m.props, value: d(2026, 10, 14) } as never)
    expect(m.visible()).toBe("2026-11-01")
  })

  it("a changed minimum clamps the focus", () => {
    const m = make({ defaultFocusedValue: d(2026, 10, 5) })
    m.s.setProps({
      ...m.props,
      defaultFocusedValue: d(2026, 10, 5),
      minValue: d(2026, 10, 10),
    } as never)
    expect(m.focused()).toBe("2026-10-10")
  })
})

describe("announcements", () => {
  it("trigger paging from idle announces under the instance key; quick paging is keyed", () => {
    const m = make()
    m.s.send({ type: "PAGE", direction: 1, modality: "pointer" })
    m.s.send({ type: "PAGE", direction: 1, modality: "pointer" })
    expect(m.log.map((a) => [a.message, a.key])).toEqual([
      ["November 2026", "calendar-c-range"],
      ["December 2026", "calendar-c-range"],
    ])
  })

  it("keyboard paging inside the grid is silent and moves focus to the cell", () => {
    const m = make()
    m.focus()
    m.s.send({ type: "PAGE", direction: 1, modality: "keyboard" })
    expect(m.log).toEqual([])
    expect(m.focusCell.mock.lastCall?.[0]).toEqual(d(2026, 11, 14))
  })

  it("paging at the maximum is refused", () => {
    const m = make({ maxValue: d(2026, 10, 31) })
    m.s.send({ type: "PAGE", direction: 1, modality: "pointer" })
    expect(m.visible()).toBe("2026-10-01")
    expect(m.log).toEqual([])
  })
})
