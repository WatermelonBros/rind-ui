import { tooltipContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Tooltip of the trigger named `name` (role `button` unless `role` says
 * otherwise). With fake timers, pass `advanceTimers` to the adapter: `show()` and `hide()`
 * advance through the delays.
 */
export function getTooltip(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly role?: "button" | "link" },
  options?: DriverOptions,
) {
  return createDriverWith(tooltipContract, target, [anchor], options)
}
