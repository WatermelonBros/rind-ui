import { treeViewContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Tree View named `name`: expand, collapse, toggle, check, act, expand
 * siblings and all; items by accessible name or by a name path (`["src", "index.ts"]`).
 */
export function getTreeView(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(treeViewContract, target, [anchor], options)
}
