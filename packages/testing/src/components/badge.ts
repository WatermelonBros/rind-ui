import { badgeContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for a Badge: the one badge inside `within` (a container element or a Playwright
 * locator; default the target). A badge has no role and no name; several matches fail
 * listing every match.
 */
export function getBadge(
  target: Target,
  anchor: { readonly within?: Target } = {},
  options?: DriverOptions,
) {
  return createDriverWith(badgeContract, anchor.within ?? target, [], options)
}
