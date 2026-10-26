import { messageActionsContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Message Actions toolbar named `name`, or the only one in `target`. */
export function getMessageActions(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(messageActionsContract, target, anchor ? [anchor] : [], options)
}
