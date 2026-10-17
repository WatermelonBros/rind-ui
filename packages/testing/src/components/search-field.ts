import { searchFieldContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Search Field named `name`: Text Field's actions, Escape, Enter. */
export function getSearchField(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(searchFieldContract, target, [anchor], options)
}
