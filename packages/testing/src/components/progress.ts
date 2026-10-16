import { progressContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Progress named `name` (role `progressbar`). `announcements()` lists what
 * it announced since creation (the completion announcement).
 */
export function getProgress(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(progressContract, target, [anchor], options)
}
