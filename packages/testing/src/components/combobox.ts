import { comboboxContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Combobox named `name`: type, compose, open, choose, clear, queries. */
export function getCombobox(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(comboboxContract, target, [anchor], options)
}
