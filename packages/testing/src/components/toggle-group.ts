import { toggleGroupContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Toggle Group named `name`. */
export function getToggleGroup(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(toggleGroupContract, target, [anchor], options)
}
