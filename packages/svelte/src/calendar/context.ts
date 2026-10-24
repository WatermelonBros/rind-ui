import type {
  CalendarEvent,
  calendarConnect,
  calendarMachine,
  MonthGrid,
  Service,
} from "@rind-ui/core"
import { createContext } from "../context"

/** What the Root gives its parts; getters stay reactive. */
export interface CalendarHost {
  readonly view: () => ReturnType<Service<typeof calendarMachine>["view"]>
  readonly send: (event: CalendarEvent) => void
  readonly api: () => ReturnType<typeof calendarConnect>
  readonly grid: (offset: number) => MonthGrid
  readonly instance: () => string
  /** Range mode: a press that dragged has already been handled. */
  readonly dragConsumes: (press: { readonly pointerType: string }) => boolean
}
export const calendarHost = createContext<CalendarHost>("calendar")
export const calendarGrid = createContext<() => number>("calendar-grid")
