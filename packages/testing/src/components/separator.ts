import { separatorContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for a Separator: the one named `name`, or the one separator part inside
 * `within` (a container element or a Playwright locator; default the target).
 */
export function getSeparator(
  target: Target,
  anchor: { readonly name?: string | RegExp; readonly within?: Target } = {},
  options?: DriverOptions,
) {
  const { within, name } = anchor
  return createDriverWith(
    separatorContract,
    within ?? target,
    [name === undefined ? {} : { name }],
    options,
  )
}
