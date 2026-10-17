import { colorSwatchContract } from "@rind-ui/core/internal"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Color Swatch named `name` (its colour name, then any label). */
export function getColorSwatch(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(colorSwatchContract, target, [anchor], options)
}
