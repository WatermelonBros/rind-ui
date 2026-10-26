import { signaturePadContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Signature Pad labelled `label`, or the only one in `target`. */
export function getSignaturePad(
  target: Target,
  anchor?: { readonly label: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(signaturePadContract, target, anchor ? [anchor] : [], options)
}
