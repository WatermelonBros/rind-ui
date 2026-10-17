import { pinInputContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Pin Input named `name`: type, paste, fill, autofill, slots, queries. */
export function getPinInput(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(pinInputContract, target, [anchor], options)
}
