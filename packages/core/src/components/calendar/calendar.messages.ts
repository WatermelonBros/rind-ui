import type { CalendarDate } from "@internationalized/date"
import type { CalendarView, PeriodView } from "./calendar.period"

/** A trigger's name: one for every view, or one per view. */
export type ViewMessage = string | ((args: { readonly view: CalendarView }) => string)

/** The Calendar's messages; every date in them is formatted by the Calendar. */
export type CalendarMessages = {
  /** The triggers: "Previous month" / "Next month", "… year", "… years" by view. */
  readonly previous: ViewMessage
  readonly next: ViewMessage
  /** The heading button's action, after the heading text: "Choose month" / "Choose year". */
  readonly viewUp: (args: { readonly view: PeriodView }) => string
  readonly cellLabel: (args: {
    readonly date: CalendarDate
    readonly formatted: string
    /** Today, or the current month or year in the month and year views. */
    readonly today: boolean
    readonly view?: CalendarView | undefined
  }) => string
  readonly monthLabel: (args: { readonly formatted: string }) => string
  readonly visibleRange: (args: { readonly formatted: string }) => string
  /** Range mode: the focused cell's description with no anchor. */
  readonly startPrompt: string
  /**
   * Range mode: the focused cell's description while anchored (`anchor` formatted), with the
   * rules that disable some ends: the length bounds and whether unavailable dates block it.
   */
  readonly endPrompt: (args: {
    readonly anchor: string
    readonly minRangeLength?: number | undefined
    readonly maxRangeLength?: number | undefined
    readonly contiguous: boolean
  }) => string
  /** Range mode, announced politely when an anchor is set. */
  readonly anchorSet: (args: { readonly anchor: string }) => string
  /** Range mode, announced politely on a commit. */
  readonly rangeSelected: (args: { readonly start: string; readonly end: string }) => string
}

export const calendarMessages: CalendarMessages = {
  previous: ({ view }) =>
    view === "days" ? "Previous month" : view === "months" ? "Previous year" : "Previous years",
  next: ({ view }) =>
    view === "days" ? "Next month" : view === "months" ? "Next year" : "Next years",
  viewUp: ({ view }) => (view === "months" ? "Choose month" : "Choose year"),
  cellLabel: ({ formatted }) => formatted,
  monthLabel: ({ formatted }) => formatted,
  visibleRange: ({ formatted }) => formatted,
  startPrompt: "Press Enter to start a range",
  endPrompt: ({ anchor, minRangeLength: min, maxRangeLength: max, contiguous }) => {
    const parts = [`Press Enter to end the range starting ${anchor}`]
    if (min !== undefined && max !== undefined) parts.push(`Ranges are ${min} to ${max} days`)
    else if (max !== undefined) parts.push(`Ranges are at most ${max} days`)
    else if (min !== undefined) parts.push(`Ranges are at least ${min} days`)
    if (contiguous) parts.push("A range cannot include an unavailable date")
    return parts.join(". ")
  },

  anchorSet: ({ anchor }) => `Range starts ${anchor}`,
  rangeSelected: ({ start, end }) => `Selected ${start} to ${end}`,
}

/** A trigger's name in a view. */
export const viewMessage = (message: ViewMessage, view: CalendarView) =>
  typeof message === "string" ? message : message({ view })
