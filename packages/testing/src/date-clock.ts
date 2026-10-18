// A fixed clock for date components: `today` is the same on the server, in the browser and
// in every test run (pass it as the provider's `dateClock`).
import type { DateClock } from "@rind-ui/core"

/** A clock frozen at `instant` (ISO, or epoch ms) in `timeZone` (default UTC). */
export function fixedDateClock(instant: string | number, timeZone = "UTC"): DateClock {
  const ms = typeof instant === "number" ? instant : Date.parse(instant)
  return { now: () => ms, timeZone: () => timeZone }
}
