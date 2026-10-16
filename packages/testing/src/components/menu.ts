import { menuContract, nonModalMenuContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Menu opened by the trigger named `name` (a closed menu has no content
 * to find). `modal: false` for a non-modal menu.
 */
export function getMenu(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly modal?: boolean },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  return createDriverWith(
    modal === false ? (nonModalMenuContract as unknown as typeof menuContract) : menuContract, // same actions and queries; only the traits differ
    target,
    [locate],
    options,
  )
}
