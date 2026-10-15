import { radioGroupContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Radio Group named `name`. */
export function getRadioGroup(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(radioGroupContract, target, [anchor], options)
}
