import { accordionContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Accordion that has a trigger named `item`. */
export function getAccordion(
  target: Target,
  anchor: { readonly item: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(accordionContract, target, [anchor], options)
}
