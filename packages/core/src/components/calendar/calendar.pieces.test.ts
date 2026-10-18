// "A second machine reuses the pieces" (spec "Reusable Pieces"): a minimal month machine built
// from the exported pieces pages, announces once under its own key and asks for cell focus.
import { CalendarDate, GregorianCalendar } from "@internationalized/date"
import { describe, expect, it, vi } from "vitest"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { setup, type } from "../../machine/setup"
import {
  announceVisibleRange,
  type DateGridPieceProps,
  focusedValueControllable,
  prepareAnnouncer,
  requestCellFocus,
} from "./calendar.pieces"

type Props = DateGridPieceProps & {
  readonly focusedValue?: CalendarDate | undefined
  readonly defaultFocusedValue?: CalendarDate | undefined
  readonly onFocusedValueChange?: ((date: CalendarDate, details: unknown) => void) | undefined
}
type Event = { readonly type: "PAGE"; readonly direction: 1 | -1 }

const monthMachine = setup({
  types: type<{
    props: Props
    events: Event
    env: { announcer: { announce(a: Announcement): void; prepare(): () => void; cancel(): void } }
    context: Record<never, never>
    values: "focusedValue"
  }>(),
  actions: {
    page: ({ event, values, props, env, set }) => {
      if (event.type !== "PAGE") return
      const next = values.focusedValue.add({ months: event.direction })
      set("focusedValue", next)
      announceVisibleRange(env, next, props, "month-picker")
      requestCellFocus(props, next, "keyboard")
    },
  },
  effects: { prepareAnnouncer },
}).machine({
  id: "month-picker",
  initial: "idle",
  context: () => ({}),
  values: { focusedValue: focusedValueControllable(new CalendarDate(2026, 10, 14)) },
  effects: ["prepareAnnouncer"],
  states: { idle: { on: { PAGE: { actions: ["page"] } } } },
})

describe("Calendar pieces in a second machine", () => {
  it("a page moves the focused value, announces once under its key and requests cell focus", () => {
    const log: Announcement[] = []
    const prepare = vi.fn(() => () => {})
    const env = {
      announcer: { announce: (a: Announcement) => void log.push(a), prepare, cancel: () => {} },
    }
    const focusCell = vi.fn()
    const props: Props = {
      id: "mp",
      visibleMonths: 1,
      formatLocale: "en-US",
      calendar: new GregorianCalendar(),
      messages: { visibleRange: ({ formatted }) => formatted },
      focusCell,
    }
    const s = createService(monthMachine, props as never, env as never)
    s.start()
    expect(prepare).toHaveBeenCalledTimes(1)
    s.send({ type: "PAGE", direction: 1 })
    expect(String(s.view().values.focusedValue)).toBe("2026-11-14")
    expect(log).toEqual([
      expect.objectContaining({
        message: "November 2026",
        key: "month-picker-mp-range",
        priority: "polite",
      }),
    ])
    expect(focusCell).toHaveBeenCalledWith(new CalendarDate(2026, 11, 14), "keyboard")
  })
})
