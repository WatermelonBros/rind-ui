import { clipboardContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Clipboard labelled `label`, or the only one in `target`. */
export function getClipboard(
  target: Target,
  anchor?: { readonly label: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(clipboardContract, target, anchor ? [anchor] : [], options)
}
