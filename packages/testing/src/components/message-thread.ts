import { messageThreadContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Message Thread whose feed is named `name`, or the only one in `target`. */
export function getMessageThread(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(messageThreadContract, target, anchor ? [anchor] : [], options)
}
