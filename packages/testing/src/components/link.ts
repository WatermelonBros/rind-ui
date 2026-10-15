import { linkContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Link named `name`: `follow`, `followInNewTab`, `middleClick` and queries. */
export function getLink(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(linkContract, target, [anchor], options)
}
