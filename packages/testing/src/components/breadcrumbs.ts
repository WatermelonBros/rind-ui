import { breadcrumbsContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Breadcrumbs landmark named `name`: `follow`, `openCollapsed`,
 * `followCollapsed`, and the queries `items`, `current`, `collapsedCount`, `href`.
 */
export function getBreadcrumbs(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(breadcrumbsContract, target, [anchor], options)
}
