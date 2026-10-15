import { labelContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Label with exactly this text: `click`, `doubleClick` and queries. */
export function getLabel(
  target: Target,
  anchor: { readonly text: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(labelContract, target, [anchor], options)
}
