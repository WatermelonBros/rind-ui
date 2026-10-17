import { imageContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for an Image: the one named `name` (role `img`: the `<img>` while it loads, Root
 * when there is no image to show; the same driver in every status), or, for a decorative
 * image, the one image root inside `within` (a container element or a Playwright locator).
 */
export function getImage(
  target: Target,
  anchor: { readonly name?: string | RegExp; readonly within?: Target } = {},
  options?: DriverOptions,
) {
  const { within, name } = anchor
  return createDriverWith(
    imageContract,
    within ?? target,
    [name === undefined ? {} : { name }],
    options,
  )
}
