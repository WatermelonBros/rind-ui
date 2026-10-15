import { tabsContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Tabs (tab list) named `name`. */
export function getTabs(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(tabsContract, target, [anchor], options)
}
