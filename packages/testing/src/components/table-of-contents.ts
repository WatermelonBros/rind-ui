import { tableOfContentsContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Table of Contents named `name`, or the only one in `target`. */
export function getTableOfContents(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(tableOfContentsContract, target, anchor ? [anchor] : [], options)
}
