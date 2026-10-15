import {
  CRITICAL,
  focusAttrs,
  type LayerMeta,
  type Modality,
  type PartProps,
  partId,
  scopeAttrs,
} from "@rind-ui/core"
import type { LayerEvent } from "./layer.machine"

export type LayerPart =
  | "root"
  | "trigger"
  | "positioner"
  | "backdrop"
  | "content"
  | "title"
  | "close"

/** Layer state → framework-neutral props per part. */
export function connect(
  state: {
    readonly open: boolean
    readonly modal: boolean
    /** The stack's metadata while open (data-nested, --layer-index …). */
    readonly meta?: LayerMeta | undefined
    /** Focus is inside the content. */
    readonly focusWithin?: boolean | undefined
    /** The trigger has focus, and the current modality (data-focus-visible). */
    readonly triggerFocused?: boolean | undefined
    readonly modality?: Modality | undefined
  },
  send: (event: LayerEvent) => void,
  root: string,
) {
  const dataState = state.open ? "open" : "closed"
  const id = (part: LayerPart) => partId("layer", root, part)
  const scope = (part: LayerPart) => ({
    ...scopeAttrs("layer", part, root),
    "data-state": dataState,
  })
  // Stacking metadata on the layer's own parts, for styling.
  const stacking = (): PartProps =>
    state.meta
      ? {
          "data-nested": state.meta.nested ? "" : undefined,
          "data-has-nested": state.meta.hasNested ? "" : undefined,
          style: {
            "--layer-index": String(state.meta.index),
            "--nested-layer-count": String(state.meta.nestedCount),
          },
        }
      : {}
  return {
    open: state.open,
    root: (): PartProps => scope("root"),
    trigger: (): PartProps => ({
      ...scope("trigger"),
      id: id("trigger"),
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": String(state.open),
      "aria-controls": state.open ? id("content") : undefined,
      onClick: () => send({ type: "TOGGLE" }),
      ...focusAttrs(state.triggerFocused === true, state.modality ?? "keyboard"),
      [CRITICAL]: ["aria-expanded"],
    }),
    positioner: (): PartProps => ({ ...scope("positioner"), id: id("positioner"), ...stacking() }),
    backdrop: (): PartProps => ({ ...scope("backdrop"), id: id("backdrop"), ...stacking() }),
    content: (): PartProps => ({
      ...scope("content"),
      ...stacking(),
      id: id("content"),
      role: "dialog",
      "aria-modal": state.modal ? "true" : undefined,
      "aria-labelledby": id("title"),
      tabIndex: -1,
      "data-focus-within": state.focusWithin ? "" : undefined,
    }),
    title: (): PartProps => ({ ...scope("title"), id: id("title") }),
    close: (): PartProps => ({
      ...scope("close"),
      id: id("close"),
      type: "button",
      onClick: () => send({ type: "CLOSE", reason: "close-button" }),
    }),
  }
}
