import { colorAreaContract } from "@rind-ui/core/internal"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Color Area named `name` (its group). */
export function getColorArea(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(colorAreaContract, target, [anchor], options)
}
