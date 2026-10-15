import { separatorContract, separatorContractFor } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for a Separator: the one named `name`, or the one separator part inside
 * `within` (a container element or a Playwright locator; default the target). `host`: the
 * scope of the component that draws it (`"toolbar"` for `Toolbar.Separator`).
 */
export function getSeparator(
  target: Target,
  anchor: {
    readonly name?: string | RegExp
    readonly within?: Target
    readonly host?: string
  } = {},
  options?: DriverOptions,
) {
  const { within, name, host } = anchor
  const contract = host === undefined ? separatorContract : separatorContractFor(host)
  return createDriverWith(contract, within ?? target, [name === undefined ? {} : { name }], options)
}
