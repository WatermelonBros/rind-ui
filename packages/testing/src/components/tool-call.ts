import { toolCallContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Tool Call whose Header is named `name`, or the only one in `target`. */
export function getToolCall(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(toolCallContract, target, anchor ? [anchor] : [], options)
}
