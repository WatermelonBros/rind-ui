import { hoverCardContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Hover Card previewed by the link (or `role`) named `name`. */
export function getHoverCard(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly role?: "link" | "button" },
  options?: DriverOptions,
) {
  return createDriverWith(hoverCardContract, target, [anchor], options)
}
