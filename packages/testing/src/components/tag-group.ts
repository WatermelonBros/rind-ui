import { tagGroupContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Tag Group named `name`: remove, act, choose, typeahead, queries. */
export function getTagGroup(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(tagGroupContract, target, [anchor], options)
}
