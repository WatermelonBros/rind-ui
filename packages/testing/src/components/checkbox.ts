import { checkboxContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Checkbox named `name`. */
export function getCheckbox(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(checkboxContract, target, [anchor], options)
}
