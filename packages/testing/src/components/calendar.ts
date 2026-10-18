import { calendarContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Calendar named `name`: select, focusDate, paging, queries. */
export function getCalendar(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(calendarContract, target, [anchor], options)
}
