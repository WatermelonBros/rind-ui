import { headingContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the heading named `name`: `level()`. */
export function getHeading(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(headingContract, target, [anchor], options)
}
