import { ratingContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Rating whose accessible name (its Label) is `name`. */
export function getRating(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(ratingContract, target, [anchor], options)
}
