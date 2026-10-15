import { formContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Form named `name`: `submit`, `reset`, `validate`, and its queries. */
export function getForm(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(formContract, target, [anchor], options)
}
