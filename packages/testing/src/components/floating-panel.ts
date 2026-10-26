import { floatingPanelContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Floating Panel titled `title`, or the only one in `target`. */
export function getFloatingPanel(
  target: Target,
  anchor?: { readonly title: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(floatingPanelContract, target, anchor ? [anchor] : [], options)
}
