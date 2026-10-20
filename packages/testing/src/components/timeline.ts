import { timelineContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Timeline named `name`, or the only one in `target`. */
export function getTimeline(
  target: Target,
  anchor: { readonly name?: string | RegExp } = {},
  options?: DriverOptions,
) {
  return createDriverWith(timelineContract, target, [anchor], options)
}
