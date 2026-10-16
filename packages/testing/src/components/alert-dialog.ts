import { alertDialogContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Alert Dialog named `name`, located through its trigger (`trigger`,
 * default `name`: a closed dialog has no content to find). It is always modal.
 */
export function getAlertDialog(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly trigger?: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(alertDialogContract, target, [anchor], options)
}
