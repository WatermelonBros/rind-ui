import {
  type AlertDialogProps,
  alertDialogConnect,
  alertDialogMachine,
  partId,
} from "@rind-ui/core"
import { type ComponentPropsWithRef, useEffect, useId, useRef, useState } from "react"
import { createDialogRoot, Dialog, type DialogRootProps, useApi, useDialog } from "../dialog/dialog"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

/** The Dialog's Root props without `modal` and `closeOnInteractOutside` (always modal). */
export type AlertDialogRootProps = Omit<DialogRootProps, "modal" | "closeOnInteractOutside"> &
  Omit<AlertDialogProps, "root" | "parent">

const RootImpl = createDialogRoot({
  scope: "alert-dialog",
  kind: "alertdialog",
  machine: alertDialogMachine,
  alwaysModal: true,
})
const Root = (props: AlertDialogRootProps) => <RootImpl {...props} />

type ButtonProps = ComponentPropsWithRef<"button"> & { readonly render?: RenderProp }

/** Cancel and Action: press-activated buttons of the alert dialog. */
function useAlertButton(part: "cancel" | "action", id: string | undefined, disabled: boolean) {
  const ctx = useDialog(part === "cancel" ? "AlertDialog.Cancel" : "AlertDialog.Action")
  const { input } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const generated = useId()
  const own = id ?? partId(ctx.scope, ctx.root, `${part}-${generated.replace(/:/g, "")}`)
  const api = alertDialogConnect(input, ctx.service.send)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type !== "PRESS") return
      if (part === "cancel") api.pressCancel(e.modality)
      else api.pressAction(own, e.modality)
    },
    disabled: () => disabled,
  })
  const props = normalizeProps(
    api[part]({ id: own, focused, modality, pressed: press.pressed, disabled }),
  )
  return {
    props: joinHandlers(props, press.props, {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    }),
  }
}

function Cancel({ id, disabled = false, render, ref, ...rest }: ButtonProps) {
  const el = useRef<HTMLElement | null>(null)
  const { props } = useAlertButton("cancel", id, disabled)
  return renderPart(
    "button",
    mergeProps(
      { ...props, ...(disabled ? { disabled: true } : {}), ref: composeRefs(el, ref) },
      rest,
    ),
    render,
    undefined,
  )
}

function Action({ id, disabled = false, render, ref, ...rest }: ButtonProps) {
  const el = useRef<HTMLElement | null>(null)
  const { props } = useAlertButton("action", id, disabled)
  return renderPart(
    "button",
    mergeProps(
      { ...props, ...(disabled ? { disabled: true } : {}), ref: composeRefs(el, ref) },
      rest,
    ),
    render,
    undefined,
  )
}

export const AlertDialog = {
  Root,
  Trigger: Dialog.Trigger,
  Portal: Dialog.Portal,
  Backdrop: Dialog.Backdrop,
  Positioner: Dialog.Positioner,
  Content: Dialog.Content,
  Title: Dialog.Title,
  Description: Dialog.Description,
  Cancel,
  Action,
}
