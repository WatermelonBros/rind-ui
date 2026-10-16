import type { CalendarDate } from "@internationalized/date"

/** The Calendar's messages; every date in them is formatted by the Calendar. */
export type CalendarMessages = {
  readonly previous: string
  readonly next: string
  readonly cellLabel: (args: {
    readonly date: CalendarDate
    readonly formatted: string
    readonly today: boolean
  }) => string
  readonly monthLabel: (args: { readonly formatted: string }) => string
  readonly visibleRange: (args: { readonly formatted: string }) => string
}

export const calendarMessages: CalendarMessages = {
  previous: "Previous month",
  next: "Next month",
  cellLabel: ({ formatted }) => formatted,
  monthLabel: ({ formatted }) => formatted,
  visibleRange: ({ formatted }) => formatted,
}
