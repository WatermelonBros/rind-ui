import { imageViewerContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Image Viewer named `name` (its image's alt), or the only one in `target`. */
export function getImageViewer(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(imageViewerContract, target, anchor ? [anchor] : [], options)
}
