import { paginationContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Pagination landmark named `name` (default name: "Pagination"). */
export function getPagination(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(paginationContract, target, [anchor], options)
}
