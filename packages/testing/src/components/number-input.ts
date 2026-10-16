import { numberInputContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Number Input named `name` (`role: "textbox"` under the iOS quirk). */
export function getNumberInput(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly role?: "spinbutton" | "textbox" },
  options?: DriverOptions,
) {
  return createDriverWith(numberInputContract, target, [anchor], options)
}
