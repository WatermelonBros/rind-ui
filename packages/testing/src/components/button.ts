import { buttonContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Button named `name` (role `link` when rendered as a link). */
export function getButton(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly role?: "button" | "link" },
  options?: DriverOptions,
) {
  return createDriverWith(buttonContract, target, [anchor], options)
}
