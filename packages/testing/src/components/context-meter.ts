import { contextMeterContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Context Meter named `name`, or the only one in `target`. */
export function getContextMeter(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(contextMeterContract, target, anchor ? [anchor] : [], options)
}
