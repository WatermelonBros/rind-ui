import { angleSliderContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Angle Slider labelled `label`, or the only one in `target`. */
export function getAngleSlider(
  target: Target,
  anchor?: { readonly label: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(angleSliderContract, target, anchor ? [anchor] : [], options)
}
