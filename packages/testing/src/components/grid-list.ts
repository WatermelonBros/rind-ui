import { gridListContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Grid List named `name`: act, check, controls, choose, typeahead, queries. */
export function getGridList(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(gridListContract, target, [anchor], options)
}
