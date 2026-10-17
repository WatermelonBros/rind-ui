import { drawerContract, nonModalDrawerContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Drawer opened by the trigger named `trigger` (default: `name`): open,
 * close, swipe, pressHandle, pressEscape, queries.
 */
export function getDrawer(
  target: Target,
  anchor: {
    readonly name: string | RegExp
    readonly trigger?: string | RegExp
    readonly modal?: boolean
  },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  return createDriverWith(
    modal === false ? nonModalDrawerContract : drawerContract,
    target,
    [locate],
    options,
  )
}
