import { reasoningContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Reasoning whose Trigger is named `name`, or the only one in `target`. */
export function getReasoning(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(reasoningContract, target, anchor ? [anchor] : [], options)
}
