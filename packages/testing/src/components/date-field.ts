import { dateFieldContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Date Field whose group is named `name`. */
export function getDateField(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(dateFieldContract, target, [anchor], options)
}
