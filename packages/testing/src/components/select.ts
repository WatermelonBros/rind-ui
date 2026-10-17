import { selectContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Select named `name`: open, choose, typeahead, form and value queries. */
export function getSelect(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(selectContract, target, [anchor], options)
}
