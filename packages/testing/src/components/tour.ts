import { modalTourContract, tourContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Tour started by the trigger named `name` (an idle tour has no card to
 * find). `modal: true` for a tour with `modal`. `announcements()` lists what it announced
 * since the driver was created.
 */
export function getTour(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly modal?: boolean },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  return createDriverWith(
    modal === true ? (modalTourContract as unknown as typeof tourContract) : tourContract, // same actions and queries; only the traits differ
    target,
    [locate],
    options,
  )
}
