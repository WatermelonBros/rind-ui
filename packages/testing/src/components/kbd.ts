import { kbdContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Kbd whose text matches `text`, or the only one in `target`. */
export function getKbd(
  target: Target,
  anchor: { readonly text?: string | RegExp } = {},
  options?: DriverOptions,
) {
  return createDriverWith(kbdContract, target, [anchor], options)
}
