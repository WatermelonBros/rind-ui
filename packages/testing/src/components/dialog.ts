import { alertDialogRoleContract, dialogContract, nonModalDialogContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Dialog named `name`, located through its trigger (`trigger`, default
 * `name`: a closed dialog has no content to find). `modal: false` for a non-modal dialog;
 * `role: "alertdialog"` for a confirmation (an outside press leaves it open; `cancel()` and
 * `confirm(name?)` press its buttons).
 */
export function getDialog(
  target: Target,
  anchor: {
    readonly name: string | RegExp
    readonly trigger?: string | RegExp
  } & (
    | { readonly role?: "dialog"; readonly modal?: boolean }
    | { readonly role: "alertdialog"; readonly modal?: never }
  ),
  options?: DriverOptions,
) {
  const { modal, role, ...locate } = anchor
  const contract =
    role === "alertdialog"
      ? alertDialogRoleContract
      : modal === false
        ? nonModalDialogContract
        : dialogContract
  // Same actions and queries; only the traits and the outside-press rule differ.
  return createDriverWith(contract as unknown as typeof dialogContract, target, [locate], options)
}
