import { mentionsContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Mentions field named `name`, or the only one in `target`. */
export function getMentions(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(mentionsContract, target, anchor ? [anchor] : [], options)
}
