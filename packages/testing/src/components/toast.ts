import { toastContract, toasterContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the toaster region named `name` ("Notifications (F6)"): enter, leave, queries. */
export function getToaster(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(toasterContract, target, [anchor], options)
}

/** A driver for the toast titled `name`: dismiss, swipe, act, hover, waitForTimeout, queries. */
export function getToast(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(toastContract, target, [anchor], options)
}
