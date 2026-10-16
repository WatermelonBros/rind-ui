// Calendar pieces reused by Range Calendar, Month Picker and Year Picker without a copy
// (spec "Reusable Pieces"): the focused-value controllable, the announcer preparation, the
// cell-focus request and the announce-on-page action. Exporting them changes no behaviour.

import { type CalendarDate, isSameDay, startOfMonth } from "@internationalized/date"
import type { AnnouncerEnv } from "../../env/capabilities"
import { formatVisibleRange } from "../../i18n/date"
import { lastVisibleMonth, type NavigationOptions } from "./calendar.navigation"

/** The focused-value controllable (`focusedValue` / `defaultFocusedValue` / `onFocusChange`). */
export const focusedValueControllable = (fallback: CalendarDate) => ({
  fallback,
  // By day: a new object for the same day changes nothing.
  equal: (a: CalendarDate, b: CalendarDate) => isSameDay(a, b),
})

/** What the pieces read from a date grid machine's props. */
export interface DateGridPieceProps extends Pick<NavigationOptions, "visibleMonths"> {
  readonly id: string
  readonly formatLocale: string
  readonly calendar: import("@internationalized/date").Calendar
  readonly messages: { readonly visibleRange: (args: { readonly formatted: string }) => string }
  /** Moves DOM focus to the focused cell once the step is rendered (adapter). */
  readonly focusCell?: ((date: CalendarDate) => void) | undefined
}

/** The visible range text ("October 2026", "October – November 2026"). */
export function visibleRangeText(visibleStart: CalendarDate, props: DateGridPieceProps): string {
  return props.messages.visibleRange({
    formatted: formatVisibleRange(
      startOfMonth(visibleStart),
      lastVisibleMonth(visibleStart, props),
      props.formatLocale,
      props.calendar,
    ),
  })
}

/** Announce-on-page: politely, keyed per instance, so quick paging speaks the last range only. */
export function announceVisibleRange(
  env: AnnouncerEnv,
  visibleStart: CalendarDate,
  props: DateGridPieceProps,
  scope: string,
) {
  env.announcer.announce({
    message: visibleRangeText(visibleStart, props),
    priority: "polite",
    key: `${scope}-${props.id}-range`,
  })
}

/** The announcer's regions exist before the first message (react-spectrum#3559). */
export const prepareAnnouncer = ({ env }: { readonly env: AnnouncerEnv }) => env.announcer.prepare()

/** Asks the adapter to focus the focused cell after the step commits. */
export const requestCellFocus = (props: DateGridPieceProps, date: CalendarDate) =>
  props.focusCell?.(date)
