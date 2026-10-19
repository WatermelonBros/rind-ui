import { imageCropperContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Image Cropper named `name`, or the only one in `target`. */
export function getImageCropper(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(imageCropperContract, target, anchor ? [anchor] : [], options)
}
