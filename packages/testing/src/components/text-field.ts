import { textFieldContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Text Field named `name`: type, fill, clear, compose, blur, queries. */
export function getTextField(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(textFieldContract, target, [anchor], options)
}
