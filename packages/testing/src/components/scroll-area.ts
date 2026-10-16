import { scrollAreaContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for a Scroll Area: the one whose Viewport is the region named `name`, or the one
 * whose Content holds `text`.
 */
export function getScrollArea(
  target: Target,
  anchor: { readonly name: string | RegExp } | { readonly text: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(scrollAreaContract, target, [anchor], options)
}
