import { splitterContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Splitter one of whose handles is named `name`. */
export function getSplitter(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(splitterContract, target, [anchor], options)
}
