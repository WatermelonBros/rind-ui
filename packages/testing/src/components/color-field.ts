import { colorChannelFieldContract, colorFieldContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Color Field whose text input is named `name`. */
export function getColorField(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(colorFieldContract, target, [anchor], options)
}

/** A driver for a Color Channel Field: Number Input's, plus `channel()` and `color()`. */
export function getColorChannelField(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(colorChannelFieldContract, target, [anchor], options)
}
