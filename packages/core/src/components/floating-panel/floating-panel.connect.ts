// Floating Panel parts (add-floating-panel design §4–§6): a non-modal dialog; the DragTrigger the
// one focusable move-and-resize control (keys), the ResizeTriggers decorative pointer handles;
// stage triggers named by what they will do; the rect on the Positioner as CSS variables.

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LinkEnv } from "../../dom/link"
import type { Rect, ResizeAxis } from "../../dom/rect-bounds"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { buttonLikeProps } from "../shared/button-like"
import type { FloatingPanelEvent, FloatingPanelState, PanelStage } from "./floating-panel.machine"
import type { FloatingPanelMessages } from "./floating-panel.messages"

export type FloatingPanelPart =
  | "root"
  | "trigger"
  | "positioner"
  | "content"
  | "header"
  | "drag-trigger"
  | "drag-hint"
  | "title"
  | "description"
  | "control"
  | "stage-trigger"
  | "close-trigger"
  | "body"
  | "resize-trigger"

/** A key on the DragTrigger: arrows move (Alt: resize), Enter and Space toggle maximised. */
export function floatingPanelKeyEvent(
  k: KeyDescription,
  options: { readonly dir: "ltr" | "rtl"; readonly dragging: boolean },
): FloatingPanelEvent | null {
  if (k.composing || k.ctrl || k.meta) return null
  if (k.key === "Escape") return options.dragging ? { type: "DRAG.CANCEL" } : null
  if (k.key === "Enter" || k.key === " ") return k.alt ? null : { type: "STAGE.TOGGLE_MAXIMIZED" }
  const rtl = options.dir === "rtl"
  const d: Record<string, readonly [-1 | 0 | 1, -1 | 0 | 1]> = {
    ArrowRight: [rtl ? -1 : 1, 0],
    ArrowLeft: [rtl ? 1 : -1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const v = d[k.key]
  if (!v) return null
  return { type: k.alt ? "RESIZE.STEP" : "MOVE.STEP", dx: v[0], dy: v[1], large: k.shift }
}

export interface FloatingPanelButtonInput {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export interface FloatingPanelConnectInput {
  readonly instance: string
  readonly open: boolean
  readonly state: FloatingPanelState
  readonly rect: Rect
  readonly stage: PanelStage
  readonly disabled: boolean
  readonly draggable: boolean
  readonly resizable: boolean
  readonly messages: FloatingPanelMessages
  readonly ids: {
    readonly content: string
    readonly title: string
    readonly description: string
    readonly hint: string
  }
  readonly rendered: { readonly description: boolean }
}

export function floatingPanelConnect(input: FloatingPanelConnectInput, env: LinkEnv) {
  const m = input.messages
  const base = (part: FloatingPanelPart): PartProps => ({
    ...scopeAttrs("floating-panel", part, input.instance),
    "data-state": input.open ? "open" : "closed",
    "data-stage": input.stage,
    "data-dragging": dataFlag(input.state === "moving"),
    "data-resizing": dataFlag(input.state === "resizing"),
    "data-disabled": dataFlag(input.disabled),
  })
  const button = (part: FloatingPanelPart, b: FloatingPanelButtonInput): PartProps => ({
    ...buttonLikeProps(
      {
        role: "button",
        tag: b.tag,
        type: "button",
        disabled: input.disabled,
        focusableWhenDisabled: true,
      },
      env,
    ),
    ...base(part),
    ...focusAttrs(b.focused, b.modality),
  })
  const px = (n: number) => `${Math.round(n)}px`
  const minimized = input.stage === "minimized"
  return {
    root: (): PartProps => base("root"),
    trigger: (b: FloatingPanelButtonInput): PartProps => ({
      ...button("trigger", b),
      "aria-haspopup": "dialog",
      "aria-expanded": input.open ? "true" : "false",
      "aria-controls": input.open ? input.ids.content : undefined,
    }),
    positioner: (): PartProps => ({
      ...base("positioner"),
      style: {
        position: "absolute",
        "--rind-floating-panel-x": px(input.rect.x),
        "--rind-floating-panel-y": px(input.rect.y),
        "--rind-floating-panel-width": px(input.rect.width),
        "--rind-floating-panel-height": px(input.rect.height),
      },
    }),
    content: (): PartProps => ({
      ...base("content"),
      id: input.ids.content,
      role: "dialog",
      "aria-labelledby": input.ids.title,
      "aria-describedby": input.rendered.description ? input.ids.description : undefined,
      tabindex: -1,
      [CRITICAL]: ["role"],
    }),
    header: (): PartProps => base("header"),
    dragTrigger: (b: FloatingPanelButtonInput): PartProps => ({
      ...button("drag-trigger", b),
      "aria-label": m.move,
      "aria-describedby": input.ids.hint,
      "aria-disabled": input.draggable && !input.disabled ? undefined : "true",
      style: { "touch-action": "none" },
    }),
    /** The DragTrigger's visually hidden description. */
    dragHint: (): PartProps => ({
      ...base("drag-hint"),
      id: input.ids.hint,
      style: visuallyHiddenStyle,
    }),
    hintText: m.moveHint,
    title: (): PartProps => ({ ...base("title"), id: input.ids.title }),
    description: (): PartProps => ({ ...base("description"), id: input.ids.description }),
    control: (): PartProps => base("control"),
    /** `target`: the stage it switches to (pressing it again from there restores). */
    stageTrigger: (
      target: Exclude<PanelStage, "default">,
      b: FloatingPanelButtonInput,
    ): PartProps => {
      const restores = input.stage === target
      return {
        ...button("stage-trigger", b),
        "aria-label": restores ? m.restore : target === "minimized" ? m.minimize : m.maximize,
        "data-stage-target": restores ? "default" : target,
      }
    },
    closeTrigger: (b: FloatingPanelButtonInput): PartProps => ({
      ...button("close-trigger", b),
      "aria-label": m.close,
    }),
    body: (): PartProps => ({
      ...base("body"),
      inert: minimized ? true : undefined,
      hidden: minimized ? true : undefined,
    }),
    resizeTrigger: (axis: ResizeAxis): PartProps => ({
      ...base("resize-trigger"),
      "data-axis": axis,
      "aria-hidden": "true",
      hidden: input.resizable && input.stage === "default" ? undefined : true,
      style: { "touch-action": "none" },
    }),
  }
}

export type FloatingPanelApi = ReturnType<typeof floatingPanelConnect>
