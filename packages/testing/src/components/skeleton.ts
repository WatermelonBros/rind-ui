import { skeletonContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the one Skeleton inside `within` (a container element or a Playwright
 * locator; default the target). `announcements()` lists what it announced since creation.
 */
export function getSkeleton(
  target: Target,
  anchor: { readonly within?: Target } = {},
  options?: DriverOptions,
) {
  return createDriverWith(skeletonContract, anchor.within ?? target, [], options)
}
