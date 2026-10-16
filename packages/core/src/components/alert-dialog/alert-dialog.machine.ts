// Alert Dialog (design §1): the Dialog's machine with its own kind and defaults — always
// modal, outside presses never close it, Cancel and Action close it, focus starts on
// Cancel. Built from the same definition, never a copy (reka-ui#2702).

import { buildDialogMachine, type DialogProps } from "../dialog/dialog.machine"

export const alertDialogMachine = buildDialogMachine({
  scope: "alert-dialog",
  kind: "alertdialog",
  closeParts: ["CANCEL_PRESS", "ACTION_PRESS"],
  alwaysModal: true,
  closeOnInteractOutside: false,
  initialFocus: "cancel",
  describe: true,
})
export type AlertDialogMachine = typeof alertDialogMachine

/** The Dialog's props without the ones an Alert Dialog fixes (always modal, no outside close). */
export type AlertDialogProps = Omit<DialogProps, "modal" | "closeOnInteractOutside">
