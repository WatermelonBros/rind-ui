import { avatarContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for an Avatar: the one named `name` (role `img`), or, for a decorative avatar,
 * the one avatar root inside `within` (a container element or a Playwright locator).
 */
export function getAvatar(
  target: Target,
  anchor: { readonly name?: string | RegExp; readonly within?: Target } = {},
  options?: DriverOptions,
) {
  const { within, name } = anchor
  return createDriverWith(
    avatarContract,
    within ?? target,
    [name === undefined ? {} : { name }],
    options,
  )
}
