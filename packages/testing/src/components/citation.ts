import { citationContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the citation marker named `name`, or the first in `target`. */
export function getCitation(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(citationContract, target, anchor ? [anchor] : [], options)
}
