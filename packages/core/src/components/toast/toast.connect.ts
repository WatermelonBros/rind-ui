// Toast parts (design §4–5): the region (a named `section`, never a live region, carrying
// `data-rind-top-layer` so it stays usable above modal layers), the list, and one `li` per
// toast with its title, description, action and close triggers. Relations point only at
// rendered parts (zag#3400); stack positions are CSS variables from the presented order
// and measured heights.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { partId } from "../../ids"
import type { ToastEvent } from "./toast.machine"
import type { ToastMessages } from "./toast.messages"
import type { ToastInstance } from "./toast.types"
import type { ToastPlacement, ToastSnapshot } from "./toaster"

export type ToastPart =
  | "region"
  | "list"
  | "root"
  | "title"
  | "description"
  | "action-trigger"
  | "close-trigger"

export interface ToasterConnectInput {
  readonly instance: string
  readonly placement: ToastPlacement
  readonly toasts: readonly ToastSnapshot[]
  readonly expanded: boolean
  /** A region-level reason holds (hover, focus, hidden). */
  readonly paused: boolean
  readonly gap: number
  readonly hotkey: string
  readonly messages: ToastMessages
}

/** One toast's own state for its parts. */
export interface ToastPartState {
  /** The title / description parts that are rendered (relations only to those). */
  readonly rendered: { readonly title: boolean; readonly description: boolean }
  /** The toast itself has focus (the hotkey, a Tab stop). */
  readonly focused: boolean
  readonly modality: Modality
}

/** A button part's own state. */
export interface ToastButtonState {
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
}

export const toastIds = (instance: string, toast: ToastInstance) => ({
  region: partId("toast", instance, "region"),
  root: partId("toast", instance, `root-${toast}`),
  title: partId("toast", instance, `title-${toast}`),
  description: partId("toast", instance, `description-${toast}`),
})

/** A toast's own instance: its parts resolve within it (several toasts share a region). */
export const toastInstanceOf = (region: string, toast: ToastInstance) => `${region}-${toast}`

export function toasterConnect(input: ToasterConnectInput) {
  const { instance } = input
  const [side, align] = input.placement.split("-") as ["top" | "bottom", "start" | "center" | "end"]
  // Presented order (newest first) without the exiting ones, for indices and offsets.
  const live = input.toasts.filter((t) => t.state !== "dismissed" && !t.limited)
  const indexOf = (t: ToastSnapshot) => live.indexOf(t)
  const offsets = new Map<ToastInstance, number>()
  let sum = 0
  for (const t of live) {
    offsets.set(t.instance, sum)
    sum += t.height + input.gap
  }
  const front = live[0]
  return {
    /** Rendered only while a toast is shown (zag#2988). */
    visible: input.toasts.length > 0,
    region: (): PartProps => ({
      ...scopeAttrs("toast", "region", instance),
      id: toastIds(instance, "" as ToastInstance).region,
      "aria-label": input.messages.regionLabel(input.messages.hotkeyLabel(input.hotkey)),
      tabindex: -1,
      "data-rind-top-layer": "",
      "data-placement": input.placement,
      "data-side": side,
      "data-align": align,
      "data-expanded": dataFlag(input.expanded),
      "data-paused": dataFlag(input.paused),
      style: {
        "--rind-toast-gap": `${input.gap}px`,
        "--rind-toast-front-height": `${front?.height ?? 0}px`,
      },
    }),
    list: (): PartProps => ({ ...scopeAttrs("toast", "list", instance) }),
    root: (t: ToastSnapshot, s: ToastPartState): PartProps => {
      const ids = toastIds(instance, t.instance)
      const index = indexOf(t)
      // An exiting toast keeps its last offset (its CSS variables are not rewritten).
      const exiting = t.state === "dismissed"
      return {
        ...scopeAttrs("toast", "root", toastInstanceOf(instance, t.instance)),
        id: ids.root,
        tabindex: 0,
        "aria-labelledby": s.rendered.title ? ids.title : undefined,
        "aria-describedby": s.rendered.description ? ids.description : undefined,
        "data-state": exiting ? "closed" : "open",
        ...focusAttrs(s.focused, s.modality),
        "data-type": t.data.type,
        "data-index": exiting ? undefined : String(Math.max(0, index)),
        "data-front": dataFlag(!exiting && index === 0),
        "data-expanded": dataFlag(input.expanded),
        "data-limited": dataFlag(t.limited),
        "data-paused": dataFlag(t.reasons.size > 0),
        "data-swiping": dataFlag(t.swiping),
        "data-swipe-direction": t.swipeDirection ?? undefined,
        "data-swipe-out": dataFlag(exiting && t.dismissReason === "swipe"),
        "data-dismiss-reason": exiting ? (t.dismissReason ?? undefined) : undefined,
        ...(t.limited ? { inert: true } : {}),
        style: exiting
          ? {}
          : {
              "--rind-toast-index": String(Math.max(0, index)),
              "--rind-toast-height": `${t.height}px`,
              "--rind-toast-offset": `${offsets.get(t.instance) ?? 0}px`,
            },
      }
    },
    title: (t: ToastSnapshot): PartProps => ({
      ...scopeAttrs("toast", "title", toastInstanceOf(instance, t.instance)),
      id: toastIds(instance, t.instance).title,
    }),
    description: (t: ToastSnapshot): PartProps => ({
      ...scopeAttrs("toast", "description", toastInstanceOf(instance, t.instance)),
      id: toastIds(instance, t.instance).description,
    }),
    actionTrigger: (t: ToastSnapshot, s: ToastButtonState): PartProps => ({
      ...scopeAttrs("toast", "action-trigger", toastInstanceOf(instance, t.instance)),
      type: "button",
      ...focusAttrs(s.focused, s.modality),
      "data-pressed": dataFlag(s.pressed),
    }),
    closeTrigger: (
      t: ToastSnapshot,
      s: ToastButtonState & { readonly empty: boolean },
    ): PartProps => {
      const disabled = t.data.dismissible === false
      return {
        ...scopeAttrs("toast", "close-trigger", toastInstanceOf(instance, t.instance)),
        type: "button",
        "aria-label": s.empty ? input.messages.close : undefined,
        disabled: disabled || undefined,
        "data-disabled": dataFlag(disabled),
        ...focusAttrs(s.focused, s.modality),
        "data-pressed": dataFlag(s.pressed),
      }
    },
    /** Escape on a toast (or inside it): that toast only, never a layer beneath. */
    onRootKeyDown: (send: (e: ToastEvent) => void) => (event: unknown) => {
      const e = event as KeyboardEvent
      if (e.key !== "Escape" || e.isComposing) return
      e.preventDefault()
      e.stopPropagation()
      send({ type: "ESCAPE_KEY", modality: "keyboard" })
    },
  }
}
