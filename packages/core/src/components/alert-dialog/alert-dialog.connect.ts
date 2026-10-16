// Alert Dialog parts (design §3): the Dialog's parts under the `alert-dialog` scope, always
// modal (aria-modal, data-modal), plus Cancel and Action buttons.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import {
  type DialogButtonState,
  type DialogConnectInput,
  dialogConnect,
} from "../dialog/dialog.connect"
import type { DialogEvent } from "../dialog/dialog.machine"

export type AlertDialogPart =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "cancel"
  | "action"

export type AlertDialogConnectInput = Omit<DialogConnectInput, "scope" | "modal">

export function alertDialogConnect(
  input: AlertDialogConnectInput,
  send: (event: DialogEvent) => void,
) {
  const scope = "alert-dialog"
  const dialog = dialogConnect({ ...input, scope, modal: true }, send)
  const button = (part: "cancel" | "action", s: DialogButtonState): PartProps => ({
    ...scopeAttrs(scope, part, input.instance),
    id: s.id,
    type: "button",
    ...focusAttrs(s.focused, s.modality),
    "data-pressed": dataFlag(s.pressed),
    "data-disabled": dataFlag(s.disabled === true),
  })
  return {
    trigger: dialog.trigger,
    backdrop: dialog.backdrop,
    positioner: dialog.positioner,
    content: dialog.content,
    title: dialog.title,
    description: dialog.description,
    cancel: (s: DialogButtonState): PartProps => button("cancel", s),
    action: (s: DialogButtonState): PartProps => button("action", s),
    pressTrigger: dialog.pressTrigger,
    pressCancel: (modality: Modality) => send({ type: "CANCEL_PRESS", modality }),
    pressAction: (id: string, modality: Modality) =>
      send({ type: "ACTION_PRESS", action: id, modality }),
  }
}
