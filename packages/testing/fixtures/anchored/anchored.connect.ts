import {
  anchorProps,
  arrowProps,
  CRITICAL,
  contentPlacementProps,
  focusAttrs,
  type Modality,
  type PartProps,
  type PlacementState,
  positionerProps,
  scopeAttrs,
} from "@rind-ui/core"
import type { AnchoredEvent } from "./anchored.machine"
import { anchoredIds } from "./anchored.machine"

export type AnchoredPart = "trigger" | "positioner" | "content" | "arrow" | "title" | "close"

/** Anchored state → framework-neutral props per part. */
export function connect(
  state: {
    readonly open: boolean
    readonly placement: PlacementState
    /** The anchor's resolved direction (the portalled positioner carries it). */
    readonly dir?: "ltr" | "rtl" | undefined
    readonly manual?: boolean | undefined
    /** Focus is inside the content. */
    readonly focusWithin?: boolean | undefined
    /** The trigger has focus, and the current modality (data-focus-visible). */
    readonly triggerFocused?: boolean | undefined
    readonly modality?: Modality | undefined
  },
  send: (event: AnchoredEvent) => void,
  root: string,
) {
  const ids = anchoredIds(root)
  const dataState = state.open ? "open" : "closed"
  const scope = (part: AnchoredPart) => ({
    ...scopeAttrs("anchored", part, root),
    "data-state": dataState,
  })
  return {
    open: state.open,
    trigger: (): PartProps => ({
      ...scope("trigger"),
      ...anchorProps(ids.trigger),
      id: ids.trigger,
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": String(state.open),
      "aria-controls": state.open ? ids.content : undefined,
      onClick: () => send({ type: "TOGGLE" }),
      ...focusAttrs(state.triggerFocused === true, state.modality ?? "keyboard"),
      [CRITICAL]: ["aria-expanded"],
    }),
    positioner: (): PartProps => ({
      ...scope("positioner"),
      ...positionerProps(
        state.placement,
        { positioner: ids.positioner, anchor: ids.trigger },
        { dir: state.dir, manual: state.manual === true },
      ),
    }),
    content: (): PartProps => ({
      ...scope("content"),
      ...contentPlacementProps(state.placement),
      id: ids.content,
      role: "dialog",
      "aria-labelledby": `${ids.content}-title`,
      tabindex: -1,
      "data-focus-within": state.focusWithin ? "" : undefined,
    }),
    arrow: (): PartProps => ({ ...scope("arrow"), ...arrowProps(state.placement, ids.arrow) }),
    title: (): PartProps => ({ ...scope("title"), id: `${ids.content}-title` }),
    close: (): PartProps => ({
      ...scope("close"),
      type: "button",
      onClick: () => send({ type: "CLOSE" }),
    }),
  }
}
