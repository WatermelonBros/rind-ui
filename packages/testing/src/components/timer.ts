import { timerContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the only Timer in `target`. */
export function getTimer(target: Target, options?: DriverOptions) {
  return createDriverWith(timerContract, target, [], options)
}
