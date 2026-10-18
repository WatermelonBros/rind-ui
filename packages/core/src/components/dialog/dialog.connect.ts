// Dialog parts (design §3): a trigger that opens it (and toggles a non-modal one), a
// backdrop and positioner that are dismiss surfaces, the `dialog` content named and
// described only by the parts that are rendered, a title heading, close triggers, and the
// Cancel and Action buttons of a confirmation (`role="alertdialog"`, any dialog may use them).

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LayerMeta } from "../../dom/layer-stack"
import { partId } from "../../ids"
import { type HeadingLevel, headingProps } from "../heading/heading.connect"
import type { DialogCloseReason, DialogEvent } from "./dialog.machine"
import type { DialogMessages } from "./dialog.messages"

export type DialogPart =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "close-trigger"
  | "cancel"
  | "action"

export const dialogIds = (scope: string, root: string) => ({
  content: partId(scope, root, "content"),
  title: partId(scope, root, "title"),
  description: partId(scope, root, "description"),
  positioner: partId(scope, root, "positioner"),
  backdrop: partId(scope, root, "backdrop"),
})

export interface DialogConnectInput {
  readonly scope: string
  /** The content's role: an alert dialog interrupts with a message that needs a response. */
  readonly role?: "dialog" | "alertdialog" | undefined
  readonly instance: string
  readonly open: boolean
  readonly modal: boolean
  /** The id of the trigger that opened the open dialog. */
  readonly opener: string | null
  readonly closeReason: DialogCloseReason | null
  readonly rendered: {
    readonly title?: string | undefined
    readonly description?: string | undefined
  }
  /** The content is in the document (aria-controls only then). */
  readonly contentMounted: boolean
  /** The stack's metadata while open (data-nested, --layer-index …). */
  readonly meta?: LayerMeta | undefined
  /** The title is the initial focus target (it gets tabindex=-1 while open). */
  readonly titleFocusTarget: boolean
  /** Focus is inside the content (data-focus-within; the contract's hasFocus). */
  readonly focusWithin?: boolean | undefined
  /** The content element itself has focus (touch opening, initialFocus "content"). */
  readonly contentFocused?: boolean | undefined
  readonly modality?: Modality | undefined
  readonly messages: DialogMessages
}

/** One button-like part's own state (trigger, close trigger). */
export interface DialogButtonState {
  readonly id: string
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly disabled?: boolean | undefined
}

/**
 * A press on a dismiss surface itself (backdrop, positioner beside the content) never moves
 * focus out of the dialog: it closes it (focus is restored) or, vetoed, leaves it as it was.
 */
const keepFocus = (event: unknown) => {
  const e = event as MouseEvent
  if (e.target === e.currentTarget) e.preventDefault()
}

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

export function dialogConnect(input: DialogConnectInput, send: (event: DialogEvent) => void) {
  const { scope, instance } = input
  // A confirmation is always modal, whatever the input says.
  const modal = input.modal || input.role === "alertdialog"
  const ids = dialogIds(scope, instance)
  const dataState = input.open ? "open" : "closed"
  const closeReason = !input.open && input.closeReason ? input.closeReason : undefined
  const stacking = (): PartProps =>
    input.meta
      ? {
          "data-nested": dataFlag(input.meta.nested),
          "data-has-nested": dataFlag(input.meta.hasNested),
          style: {
            "--layer-index": String(input.meta.index),
            "--nested-layer-count": String(input.meta.nestedCount),
          },
        }
      : {}
  /** Cancel and Action: press-activated buttons that close with their own reason. */
  const button = (part: "cancel" | "action", s: DialogButtonState): PartProps => ({
    ...scopeAttrs(scope, part, instance),
    id: s.id,
    type: "button",
    ...focusAttrs(s.focused, s.modality),
    "data-pressed": dataFlag(s.pressed),
    "data-disabled": dataFlag(s.disabled === true),
  })
  return {
    trigger: (s: DialogButtonState): PartProps => {
      const opened = input.open && input.opener === s.id
      return {
        ...scopeAttrs(scope, "trigger", instance),
        id: s.id,
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": String(opened),
        "aria-controls": input.contentMounted ? ids.content : undefined,
        "data-state": opened ? "open" : "closed",
        // The last close reason outlives the content (the contract's closeReason query).
        "data-close-reason": closeReason,
        "data-disabled": dataFlag(s.disabled === true),
        ...focusAttrs(s.focused, s.modality),
        "data-pressed": dataFlag(s.pressed),
        [CRITICAL]: ["aria-expanded"],
      }
    },
    /** Renders nothing while non-modal (the adapter skips it). */
    backdrop: (): PartProps => ({
      ...scopeAttrs(scope, "backdrop", instance),
      id: ids.backdrop,
      "aria-hidden": "true",
      "data-state": dataState,
      ...stacking(),
      onMouseDown: keepFocus,
    }),
    positioner: (): PartProps => {
      const s = stacking()
      return {
        ...scopeAttrs(scope, "positioner", instance),
        id: ids.positioner,
        "data-state": dataState,
        "data-modal": dataFlag(modal),
        ...s,
        onMouseDown: keepFocus,
        // Non-modal: the page outside the content stays operable (zag#3401).
        ...(modal ? {} : { style: { ...(s["style"] as object), pointerEvents: "none" } }),
      }
    },
    content: (own: {
      labelledBy?: string | undefined
      describedBy?: string | undefined
    }): PartProps => {
      const s = stacking()
      return {
        ...scopeAttrs(scope, "content", instance),
        id: ids.content,
        role: input.role ?? "dialog",
        tabindex: -1,
        "aria-modal": modal ? "true" : undefined,
        // The consumer's ids first, then the parts that are rendered (radix#3007, ark#4182).
        "aria-labelledby": join(own.labelledBy, input.rendered.title),
        "aria-describedby": join(own.describedBy, input.rendered.description),
        "data-state": dataState,
        "data-modal": dataFlag(modal),
        "data-close-reason": closeReason,
        "data-focus-within": dataFlag(input.focusWithin === true),
        ...focusAttrs(input.contentFocused === true, input.modality ?? "keyboard"),
        ...s,
        ...(modal ? {} : { style: { ...(s["style"] as object), pointerEvents: "auto" } }),
      }
    },
    title: (own: { level: HeadingLevel; tag: string }): PartProps => ({
      ...scopeAttrs(scope, "title", instance),
      ...headingProps({ level: own.level, tag: own.tag }),
      id: ids.title,
      tabindex: input.open && input.titleFocusTarget ? -1 : undefined,
    }),
    description: (): PartProps => ({
      ...scopeAttrs(scope, "description", instance),
      id: ids.description,
    }),
    closeTrigger: (s: DialogButtonState & { readonly empty: boolean }): PartProps => ({
      ...scopeAttrs(scope, "close-trigger", instance),
      id: s.id,
      type: "button",
      "aria-label": s.empty ? input.messages.close : undefined,
      ...focusAttrs(s.focused, s.modality),
      "data-pressed": dataFlag(s.pressed),
    }),
    cancel: (s: DialogButtonState): PartProps => button("cancel", s),
    action: (s: DialogButtonState): PartProps => button("action", s),
    pressCancel: (modality: Modality) => send({ type: "CANCEL_PRESS", modality }),
    pressAction: (id: string, modality: Modality) =>
      send({ type: "ACTION_PRESS", action: id, modality }),
    /** Press handlers: the adapter wires them through press interactions. */
    pressTrigger: (id: string, modality: Modality) =>
      send({ type: "TRIGGER_PRESS", trigger: id, modality }),
    pressClose: (modality: Modality) => send({ type: "CLOSE_TRIGGER_PRESS", modality }),
  }
}
