// The Calendar's drag selection (spec "Drag Selection"): cell-drag bound to the calendar's cells
// and turned into machine events, so a framework adapter only wires it. Which dates may extend
// the preview is the machine's rule (DRAG.MOVE guard), not this target lookup's.

import type { Calendar, CalendarDate } from "@internationalized/date"
import { type CalendarEvent, display } from "../components/calendar/calendar.machine"
import type { Modality } from "../contract/env"
import { parseDate } from "../i18n/date"
import { type CellDrag, type CellDragOptions, createCellDrag } from "./cell-drag"

export interface CalendarDragOptions {
  readonly env: CellDragOptions<CalendarDate>["env"]
  /** Read at event time: the Root's instance id and display calendar. */
  readonly target: () => { readonly instance: string; readonly calendar: Calendar }
  /** Read at press time: whether a press on the date starts a drag (connect's `canDrag`). */
  readonly canStart: (date: CalendarDate) => boolean
  /** Touch hold before a drag, in ms (the Root's `dragDelay`). */
  readonly delay: () => number
  /** The machine's `send`. */
  readonly send: (event: CalendarEvent) => void
}

/** An in-month cell of this instance, as its date in the display calendar; else null. */
export function calendarCellAt(
  el: Element | null,
  instance: string,
  calendar: Calendar,
): CalendarDate | null {
  const cell = el?.closest?.('[data-scope="calendar"][data-part="cell"]')
  const iso = cell?.getAttribute("data-value")
  if (!cell || !iso || cell.getAttribute("data-instance") !== instance) return null
  // A placeholder is another month's day: not a target in this grid.
  if (cell.hasAttribute("data-outside-month")) return null
  return display(parseDate(iso), calendar)
}

const modalityOf = (pointerType: string): Modality =>
  pointerType === "touch" ? "touch" : "pointer"

/** One drag controller per Calendar Root. */
export function createCalendarDrag(o: CalendarDragOptions): CellDrag {
  return createCellDrag<CalendarDate>({
    get env() {
      return o.env
    },
    keyAt: (el) => {
      const { instance, calendar } = o.target()
      return calendarCellAt(el, instance, calendar)
    },
    canStart: o.canStart,
    delay: o.delay,
    equal: (a, b) => a.compare(b) === 0,
    send: (m) => {
      if (m.type === "start")
        o.send({ type: "DRAG.START", date: m.key, modality: modalityOf(m.pointerType) })
      else if (m.type === "move") o.send({ type: "DRAG.MOVE", date: m.key })
      else if (m.type === "end")
        o.send({ type: "DRAG.END", moved: m.key !== null, modality: modalityOf(m.pointerType) })
      else o.send({ type: "DRAG.CANCEL" })
    },
  })
}
