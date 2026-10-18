import type { DialogRootProps } from "@rind-ui/react"
import type { Target } from "../driver"
import { getDialog } from "./dialog"

// A confirmation is always modal and never closed by an outside press: neither is a prop with
// role="alertdialog" (merge-alert-dialog-into-dialog; formerly add-alert-dialog 1.3).
// @ts-expect-error an alert dialog is always modal
const modal: DialogRootProps<"alertdialog"> = { role: "alertdialog", modal: false }
// @ts-expect-error an outside press never closes an alert dialog
const outside: DialogRootProps<"alertdialog"> = {
  role: "alertdialog",
  closeOnInteractOutside: true,
}
const ok: DialogRootProps<"alertdialog"> = {
  role: "alertdialog",
  closeOnEscape: false,
  initialFocus: "content",
}
const plain: DialogRootProps = { modal: false, closeOnInteractOutside: true }
void plain
void [modal, outside, ok]

declare const target: Target
const a = getDialog(target, { name: "Delete project?", role: "alertdialog" })
void a.open()
void a.cancel()
void a.confirm("Delete")
void a.confirm()
// @ts-expect-error an alert dialog has no modal option
void getDialog(target, { name: "x", modal: false, role: "alertdialog" })
// @ts-expect-error no such action
void a.explode()
// @ts-expect-error confirm takes an action name
void a.confirm(1)
