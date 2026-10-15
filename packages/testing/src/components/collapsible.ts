import { collapsibleContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Collapsible whose trigger is named `name`. */
export function getCollapsible(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(collapsibleContract, target, [anchor], options)
}
