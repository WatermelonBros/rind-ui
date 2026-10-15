import { fieldsetContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Fieldset named `name`: name, description, disabled, invalid, errors. */
export function getFieldset(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(fieldsetContract, target, [anchor], options)
}
