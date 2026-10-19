import { stepperContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Stepper named `name`, or the only one in `target`. */
export function getStepper(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(stepperContract, target, anchor ? [anchor] : [], options)
}
