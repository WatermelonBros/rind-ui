import { tableContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Table named `name`, or the only one in `target`. */
export function getTable(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(tableContract, target, anchor ? [anchor] : [], options)
}
