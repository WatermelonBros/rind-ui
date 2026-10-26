import { editableContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Editable labelled `label`, or the only one in `target`. */
export function getEditable(
  target: Target,
  anchor?: { readonly label: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(editableContract, target, anchor ? [anchor] : [], options)
}
