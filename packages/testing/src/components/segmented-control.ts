import { segmentedControlContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Segmented Control named `name`. */
export function getSegmentedControl(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(segmentedControlContract, target, [anchor], options)
}
