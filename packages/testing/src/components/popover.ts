import { modalPopoverContract, popoverContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Popover opened by the trigger named `name` (a closed popover has no
 * content to find). `modal: true` for a modal popover.
 */
export function getPopover(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly modal?: boolean },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  return createDriverWith(
    modal === true ? (modalPopoverContract as unknown as typeof popoverContract) : popoverContract, // same actions and queries; only the traits differ
    target,
    [locate],
    options,
  )
}
