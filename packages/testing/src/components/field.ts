import { fieldContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

type Anchor = { readonly label: string | RegExp }

/**
 * A driver for the Field labelled `label`. `.control(getX)` builds the control's driver,
 * located by the name the Field's Label gives it (driver composition, spec "Contract").
 */
export function getField(target: Target, anchor: Anchor, options?: DriverOptions) {
  const driver = createDriverWith(fieldContract, target, [anchor], options)
  return Object.assign(driver, {
    control<D>(
      get: (target: Target, anchor: { readonly name: string }, options?: DriverOptions) => D,
    ): D {
      return get(target, { name: typeof anchor.label === "string" ? anchor.label : "" }, options)
    },
  })
}
