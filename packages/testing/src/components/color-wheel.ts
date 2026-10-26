import { colorWheelContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Color Wheel labelled `label`, or the only one in `target`. */
export function getColorWheel(
  target: Target,
  anchor?: { readonly label: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(colorWheelContract, target, anchor ? [anchor] : [], options)
}
