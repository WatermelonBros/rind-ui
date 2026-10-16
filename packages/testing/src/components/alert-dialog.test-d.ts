import type { AlertDialogRootProps } from "@rind-ui/react"
import type { Target } from "../driver"
import { getAlertDialog } from "./alert-dialog"

// Always modal, never closed by an outside press: neither is a prop (openspec add-alert-dialog 1.3).
// @ts-expect-error an alert dialog is always modal
const modal: AlertDialogRootProps = { modal: false }
// @ts-expect-error an outside press never closes an alert dialog
const outside: AlertDialogRootProps = { closeOnInteractOutside: true }
const ok: AlertDialogRootProps = { closeOnEscape: false, initialFocus: "content" }
void [modal, outside, ok]

declare const target: Target
const a = getAlertDialog(target, { name: "Delete project?" })
void a.open()
void a.cancel()
void a.confirm("Delete")
void a.confirm()
// @ts-expect-error an alert dialog has no modal option
void getAlertDialog(target, { name: "x", modal: false })
// @ts-expect-error no such action
void a.explode()
// @ts-expect-error confirm takes an action name
void a.confirm(1)
