import { dialogContract, nonModalDialogContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Dialog named `name`, located through its trigger (`trigger`, default
 * `name`: a closed dialog has no content to find). `modal: false` for a non-modal dialog.
 */
export function getDialog(
  target: Target,
  anchor: {
    readonly name: string | RegExp
    readonly trigger?: string | RegExp
    readonly modal?: boolean
  },
  options?: DriverOptions,
) {
  const { modal, ...locate } = anchor
  return createDriverWith(
    modal === false ? (nonModalDialogContract as unknown as typeof dialogContract) : dialogContract, // same actions and queries; only the traits differ
    target,
    [locate],
    options,
  )
}
