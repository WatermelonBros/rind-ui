// Hover Card parts (design §1, spec ARIA Attributes): the trigger keeps its own role and
// href (a link) and gets the popup ARIA and the hover-intent handlers; it never prevents
// default, so a tap follows the link (reka-ui#802). The content is a non-modal dialog
// named by the consumer, else by the trigger, focusable as a container only.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LayerMeta } from "../../dom/layer-stack"
import {
  arrowProps,
  contentPlacementProps,
  type PlacementState,
  positionerProps,
} from "../../dom/position/connect"
import type { HoverTriggerProps } from "../../env/hover-intent"
import { type HoverCardCloseReason, type HoverCardEvent, hoverCardIds } from "./hover-card.machine"

export type HoverCardPart = "trigger" | "positioner" | "content" | "arrow"

export interface HoverCardConnectInput {
  readonly instance: string
  readonly open: boolean
  readonly placement: PlacementState
  readonly closeReason: HoverCardCloseReason | null
  /** The content element is in the document (aria-controls only then). */
  readonly contentMounted: boolean
  readonly meta?: LayerMeta | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  readonly manual?: boolean | undefined
  /** Focus is in the content. */
  readonly focusWithin?: boolean | undefined
}

export interface HoverCardTriggerState {
  readonly focused: boolean
  readonly hovered: boolean
  readonly modality: Modality
}

export function hoverCardConnect(
  input: HoverCardConnectInput,
  send: (event: HoverCardEvent) => void,
) {
  const { instance } = input
  const ids = hoverCardIds(instance)
  const dataState = input.open ? "open" : "closed"
  const scope = (part: HoverCardPart) => scopeAttrs("hover-card", part, instance)
  return {
    open: input.open,
    /** `hover`: the hover-intent trigger handlers. */
    trigger: (s: HoverCardTriggerState, hover: HoverTriggerProps): PartProps => ({
      ...scope("trigger"),
      id: ids.trigger,
      "aria-haspopup": "dialog",
      "aria-expanded": String(input.open),
      "aria-controls": input.contentMounted ? ids.content : undefined,
      "data-state": dataState,
      "data-hover": dataFlag(s.hovered),
      ...focusAttrs(s.focused, s.modality),
      onPointerMove: hover.onPointerMove,
      onPointerLeave: hover.onPointerLeave,
      [CRITICAL]: ["aria-expanded"],
    }),
    positioner: (): PartProps => ({
      ...scope("positioner"),
      ...positionerProps(
        input.placement,
        { positioner: ids.positioner, anchor: ids.trigger },
        { dir: input.dir, manual: input.manual === true },
      ),
      "data-state": dataState,
    }),
    content: (own: { label?: string | undefined; labelledBy?: string | undefined }): PartProps => {
      const meta = input.meta
      return {
        ...scope("content"),
        ...contentPlacementProps(input.placement),
        id: ids.content,
        role: "dialog",
        tabindex: -1,
        "aria-label": own.label,
        "aria-labelledby": own.labelledBy ?? (own.label ? undefined : ids.trigger),
        "data-state": dataState,
        "data-close-reason": !input.open ? (input.closeReason ?? undefined) : undefined,
        "data-focus-within": dataFlag(input.focusWithin === true),
        ...(meta
          ? {
              "data-nested": dataFlag(meta.nested),
              "data-has-nested": dataFlag(meta.hasNested),
              style: {
                ...(input.placement.placed ? {} : { "animation-name": "none" }),
                "--layer-index": String(meta.index),
                "--nested-layer-count": String(meta.nestedCount),
              },
            }
          : {}),
      }
    },
    arrow: (): PartProps => ({ ...scope("arrow"), ...arrowProps(input.placement, ids.arrow) }),
    /** The trigger's focus, from the adapter (modality and cause read there). */
    focus: (modality: Modality, cause: Extract<HoverCardEvent, { type: "FOCUS" }>["cause"]) =>
      send({ type: "FOCUS", modality, cause }),
    blur: () => send({ type: "BLUR" }),
    focusWithin: (inside: boolean) =>
      send({ type: inside ? "FOCUS_WITHIN.ENTER" : "FOCUS_WITHIN.LEAVE" }),
  }
}
