import { checkboxGroupContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Checkbox Group named `name`. */
export function getCheckboxGroup(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(checkboxGroupContract, target, [anchor], options)
}
