import { passwordInputContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Password Input labelled `name`: Text Field's actions, visibility, form. */
export function getPasswordInput(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(passwordInputContract, target, [anchor], options)
}
