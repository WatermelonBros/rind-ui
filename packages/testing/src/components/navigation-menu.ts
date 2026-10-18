import { navigationMenuContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Navigation Menu landmark named `name` ("Main" by default). */
export function getNavigationMenu(
  target: Target,
  anchor: { readonly name: string | RegExp } = { name: "Main" },
  options?: DriverOptions,
) {
  return createDriverWith(navigationMenuContract, target, [anchor], options)
}
