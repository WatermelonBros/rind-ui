import { listboxContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Listbox named `name`: choose, toggle, ranges, typeahead, act, queries. */
export function getListbox(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(listboxContract, target, [anchor], options)
}
