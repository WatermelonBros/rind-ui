import { jsonTreeViewContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the JSON Tree View named `name`: Tree View's actions and queries, plus
 * `nodeAt(pointer)`, `valueText(pointer)`, `summaryOf(pointer)`, `copy()` and `copyState()`.
 */
export function getJsonTreeView(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(jsonTreeViewContract, target, [anchor], options)
}
