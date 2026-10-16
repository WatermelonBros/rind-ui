// Tooltip parts (design §3, §5): the trigger is described (or labelled) by the content as
// soon as the content element is mounted — open or closed, so browse-mode reading and the
// accessible description never depend on hover (react-spectrum#2101). The content is never
// focusable. The tooltip only listens on the trigger: it never prevents default or stops
// propagation, so a menu or popover on the same trigger keeps working (bits-ui#2200).

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import {
  arrowProps,
  contentPlacementProps,
  type PlacementState,
  positionerProps,
} from "../../dom/position/connect"
import type { HoverTriggerProps } from "../../env/hover-intent"
import { type TooltipEvent, tooltipIds } from "./tooltip.machine"

export type TooltipPart = "trigger" | "positioner" | "content" | "arrow"

export interface TooltipConnectInput {
  readonly instance: string
  readonly open: boolean
  readonly instant: boolean
  readonly placement: PlacementState
  /** `description` (default): role tooltip, aria-describedby. `label`: aria-labelledby. */
  readonly type: "description" | "label"
  /** The content element is in the document (the references exist only then). */
  readonly contentMounted: boolean
  readonly dir?: "ltr" | "rtl" | undefined
  readonly manual?: boolean | undefined
}

export interface TooltipTriggerState {
  readonly focused: boolean
  readonly hovered: boolean
  readonly modality: Modality
  /**
   * Rendered through another component (a Switch, a consumer's icon button): its own id,
   * data-scope, data-part and data-state stay; the tooltip adds ARIA and handlers only.
   */
  readonly foreign?: boolean | undefined
  /** The consumer's own references, kept first (radix#2598). */
  readonly describedBy?: string | undefined
  readonly labelledBy?: string | undefined
}

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

export function tooltipConnect(input: TooltipConnectInput, send: (event: TooltipEvent) => void) {
  const { instance } = input
  const ids = tooltipIds(instance)
  const dataState = input.open ? "open" : "closed"
  const ref = input.contentMounted ? ids.content : undefined
  const scope = (part: TooltipPart) => scopeAttrs("tooltip", part, instance)
  return {
    open: input.open,
    /** `hover`: the hover-intent trigger handlers (connect merges them with the rest). */
    trigger: (s: TooltipTriggerState, hover: HoverTriggerProps): PartProps => ({
      ...(s.foreign
        ? {}
        : {
            ...scope("trigger"),
            id: ids.trigger,
            "data-state": dataState,
            "data-hover": dataFlag(s.hovered),
            ...focusAttrs(s.focused, s.modality),
          }),
      "aria-describedby": input.type === "description" ? join(s.describedBy, ref) : s.describedBy,
      "aria-labelledby": input.type === "label" ? join(s.labelledBy, ref) : s.labelledBy,
      onPointerMove: hover.onPointerMove,
      onPointerLeave: hover.onPointerLeave,
      [CRITICAL]: ["aria-describedby", "aria-labelledby"],
    }),
    positioner: (): PartProps => ({
      ...scope("positioner"),
      ...positionerProps(
        input.placement,
        { positioner: ids.positioner, anchor: ids.trigger },
        { dir: input.dir, manual: input.manual === true },
      ),
      "data-state": dataState,
      "data-instant": dataFlag(input.instant),
      // The description stays exposed while its trigger is inside a modal layer: the closed
      // content is portalled outside it (react-spectrum#8915).
      "data-rind-top-layer": "",
    }),
    content: (): PartProps => ({
      ...scope("content"),
      ...contentPlacementProps(input.placement),
      id: ids.content,
      role: input.type === "description" ? "tooltip" : undefined,
      "data-state": dataState,
      "data-instant": dataFlag(input.instant),
      "data-type": input.type,
    }),
    arrow: (): PartProps => ({ ...scope("arrow"), ...arrowProps(input.placement, ids.arrow) }),
    /** The trigger's focus and press, from the adapter (modality and cause read there). */
    focus: (modality: Modality, cause: Extract<TooltipEvent, { type: "FOCUS" }>["cause"]) =>
      send({ type: "FOCUS", modality, cause }),
    blur: () => send({ type: "BLUR" }),
    pressStart: () => send({ type: "PRESS.START" }),
  }
}
