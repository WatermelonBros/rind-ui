import { suggestionsContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Suggestions named `name`, or the only one in `target`. */
export function getSuggestions(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(suggestionsContract, target, anchor ? [anchor] : [], options)
}
