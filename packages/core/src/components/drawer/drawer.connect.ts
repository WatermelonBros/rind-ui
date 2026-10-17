// Drawer parts (design §4): the Dialog's parts under scope `drawer`, plus the side, swipe,
// snap point and nesting attributes, the handle (a button with two or more snap points,
// otherwise decorative) and the indent parts. Movement during a swipe is never here: the
// gesture writes its own variables.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { partId } from "../../ids"
import { type DialogConnectInput, dialogConnect } from "../dialog/dialog.connect"
import type { DrawerContext, DrawerEvent, PhysicalSide } from "./drawer.machine"
import type { DrawerMessages } from "./drawer.messages"
import type { ResolvedSnapPoint, SnapPoint } from "./snap-points"

export type DrawerPart =
  | "trigger"
  | "backdrop"
  | "positioner"
  | "content"
  | "title"
  | "description"
  | "close-trigger"
  | "handle"
  | "indent"
  | "indent-background"

/** What the drawer adds to the Dialog's connect input. */
export interface DrawerExtrasInput {
  readonly instance: string
  readonly open: boolean
  readonly closeReason: DialogConnectInput["closeReason"]
  readonly side: PhysicalSide
  readonly swipe: DrawerContext["swipe"]
  readonly nested: DrawerContext["nested"]
  /** Border-box size on the axis (0 before the first measure). */
  readonly size: number
  readonly resolved: readonly ResolvedSnapPoint[]
  readonly snapPoint: SnapPoint | null
  readonly messages: DrawerMessages
}

export interface DrawerConnectInput
  extends Omit<DialogConnectInput, "scope" | "messages">,
    DrawerExtrasInput {}

/** The handle's own state when it is a button. */
export interface DrawerHandleState {
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
}

const styleOf = (p: PartProps) => (p["style"] as Record<string, string> | undefined) ?? {}

/**
 * The drawer's own attributes: what it adds to the Dialog's positioner, backdrop and content
 * (an adapter passes them to the Dialog part), and the handle.
 */
export function drawerExtras(input: DrawerExtrasInput, send: (event: DrawerEvent) => void) {
  const { instance } = input
  const index = input.resolved.findIndex((r) => r.point === input.snapPoint)
  const active = index >= 0 ? input.resolved[index] : undefined
  const snapIndex = input.resolved.length > 0 && index >= 0 ? String(index) : undefined
  const expanded = input.resolved.length === 0 || index === input.resolved.length - 1
  const swiping = input.swipe === "swiping"
  const isButton = input.resolved.length >= 2
  const next =
    input.resolved.length > 0 ? input.resolved[(index + 1) % input.resolved.length] : undefined
  const growing = next !== undefined && active !== undefined && next.size > active.size
  return {
    positioner: (): PartProps => ({ "data-side": input.side }),
    backdrop: (): PartProps => ({ "data-swiping": dataFlag(swiping) }),
    content: (): PartProps => ({
      "data-side": input.side,
      "data-swiping": dataFlag(swiping),
      // From the dismissing release until the next open (a controlled parent may hold it).
      "data-swipe-dismiss": dataFlag(
        input.swipe === "releasing" || (!input.open && input.closeReason === "swipe"),
      ),
      "data-expanded": dataFlag(expanded),
      "data-snap-point": snapIndex,
      "data-nested-swiping": dataFlag(input.nested.swiping),
      style: {
        "--rind-drawer-snap-offset": `${active?.offset ?? 0}px`,
        "--rind-drawer-size": `${Math.round(input.size)}px`,
        ...(input.nested.count > 0
          ? { "--rind-drawer-frontmost-size": `${input.nested.frontmostSize}px` }
          : {}),
      },
    }),
    /** A button with two or more snap points (it cycles them), else decorative. */
    handle: (s: DrawerHandleState): PartProps =>
      isButton
        ? {
            ...scopeAttrs("drawer", "handle", instance),
            id: partId("drawer", instance, "handle"),
            type: "button",
            "aria-label": growing ? input.messages.expand : input.messages.collapse,
            "data-snap-point": snapIndex,
            ...focusAttrs(s.focused, s.modality),
            "data-pressed": dataFlag(s.pressed),
          }
        : {
            ...scopeAttrs("drawer", "handle", instance),
            id: partId("drawer", instance, "handle"),
            "aria-hidden": "true",
            "data-snap-point": snapIndex,
          },
    handleIsButton: isButton,
    pressHandle: (modality: Modality) => send({ type: "HANDLE_PRESS", modality }),
  }
}

/** Every drawer part: the Dialog's (scope `drawer`) with the drawer's attributes merged. */
export function drawerConnect(input: DrawerConnectInput, send: (event: DrawerEvent) => void) {
  const dialog = dialogConnect({ ...input, scope: "drawer" }, send)
  const extras = drawerExtras(input, send)
  return {
    ...dialog,
    handle: extras.handle,
    handleIsButton: extras.handleIsButton,
    pressHandle: extras.pressHandle,
    positioner: (): PartProps => ({ ...dialog.positioner(), ...extras.positioner() }),
    backdrop: (): PartProps => ({ ...dialog.backdrop(), ...extras.backdrop() }),
    content: (own: {
      labelledBy?: string | undefined
      describedBy?: string | undefined
    }): PartProps => {
      const base = dialog.content(own)
      const add = extras.content()
      return { ...base, ...add, style: { ...styleOf(base), ...styleOf(add) } }
    },
  }
}

/** The indent parts (no instance): `data-active` while a modal drawer is open. */
export const drawerIndentProps = (
  part: "indent" | "indent-background",
  active: boolean,
): PartProps => ({
  "data-scope": "drawer",
  "data-part": part,
  "data-active": dataFlag(active),
})
