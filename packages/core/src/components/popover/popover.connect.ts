// Popover parts (design §4): a trigger that toggles it (and anchors it unless an Anchor is
// rendered), the positioned content as a `dialog` named by its title, the consumer, or —
// non-modal only — the trigger, decorative indicator and arrow, and close triggers.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { LayerMeta } from "../../dom/layer-stack"
import type { LinkEnv } from "../../dom/link"
import {
  anchorProps,
  arrowProps,
  contentPlacementProps,
  type PlacementState,
  positionerProps,
} from "../../dom/position/connect"
import { type HeadingLevel, headingProps } from "../heading/heading.connect"
import { buttonLikeProps } from "../shared/button-like"
import { type PopoverCloseReason, type PopoverEvent, popoverIds } from "./popover.machine"
import type { PopoverMessages } from "./popover.messages"

export type PopoverPart =
  | "trigger"
  | "anchor"
  | "indicator"
  | "positioner"
  | "content"
  | "arrow"
  | "title"
  | "description"
  | "close-trigger"

export interface PopoverConnectInput {
  readonly instance: string
  /** `data-scope` of every part (default "popover"; a composite passes its own). */
  readonly scope?: string | undefined
  readonly open: boolean
  readonly modal: boolean
  readonly disabled?: boolean | undefined
  readonly placement: PlacementState
  readonly closeReason: PopoverCloseReason | null
  /** Ids of the mounted title and description: the only source of the ARIA references. */
  readonly rendered: {
    readonly title?: string | undefined
    readonly description?: string | undefined
  }
  /** The content is in the document (aria-controls only then). */
  readonly contentMounted: boolean
  /** An Anchor part is rendered: it carries the anchor name, not the trigger. */
  readonly anchorRendered?: boolean | undefined
  /** The stack's metadata while open (data-nested, --layer-index …). */
  readonly meta?: LayerMeta | undefined
  /** The anchor's resolved direction (the portalled positioner carries it). */
  readonly dir?: "ltr" | "rtl" | undefined
  /** `positioning.mode` is manual: no coordinates (consumer CSS anchor positioning). */
  readonly manual?: boolean | undefined
  readonly focusWithin?: boolean | undefined
  readonly contentFocused?: boolean | undefined
  readonly modality?: Modality | undefined
  readonly messages: PopoverMessages
}

/** One button-like part's own state (trigger, close trigger). */
export interface PopoverButtonState {
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
}

// Sound: without an href the link branch, the only reader of the link env, is never taken.
const NO_LINK = {} as LinkEnv

const join = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

export function popoverConnect(input: PopoverConnectInput, send: (event: PopoverEvent) => void) {
  const { instance } = input
  const scope = input.scope ?? "popover"
  const ids = popoverIds(instance, scope)
  const dataState = input.open ? "open" : "closed"
  const closeReason = !input.open ? (input.closeReason ?? undefined) : undefined
  const anchorId = input.anchorRendered ? ids.anchor : ids.trigger
  return {
    open: input.open,
    trigger: (s: PopoverButtonState & { readonly tag: string }): PartProps => ({
      ...scopeAttrs(scope, "trigger", instance),
      ...(input.anchorRendered ? {} : anchorProps(ids.trigger)),
      // A substituted element (a div) gets the button role and a tab stop.
      ...buttonLikeProps(
        {
          role: "button",
          tag: s.tag,
          disabled: input.disabled === true,
          focusableWhenDisabled: false,
        },
        NO_LINK,
      ),
      id: ids.trigger,
      "aria-haspopup": "dialog",
      "aria-expanded": String(input.open),
      "aria-controls": input.contentMounted ? ids.content : undefined,
      "data-state": dataState,
      ...focusAttrs(s.focused, s.modality),
      "data-pressed": dataFlag(s.pressed),
      [CRITICAL]: ["aria-expanded"],
    }),
    anchor: (): PartProps => ({
      ...scopeAttrs(scope, "anchor", instance),
      ...anchorProps(ids.anchor),
      id: ids.anchor,
    }),
    indicator: (): PartProps => ({
      ...scopeAttrs(scope, "indicator", instance),
      "aria-hidden": "true",
      "data-state": dataState,
    }),
    positioner: (): PartProps => ({
      ...scopeAttrs(scope, "positioner", instance),
      ...positionerProps(
        input.placement,
        { positioner: ids.positioner, anchor: anchorId },
        { dir: input.dir, manual: input.manual === true },
      ),
      "data-state": dataState,
    }),
    content: (own: {
      label?: string | undefined
      labelledBy?: string | undefined
      describedBy?: string | undefined
    }): PartProps => {
      const meta = input.meta
      // Title, then the consumer's own name, then (non-modal) the trigger.
      const labelledBy =
        input.rendered.title ??
        own.labelledBy ??
        (own.label || input.modal ? undefined : ids.trigger)
      return {
        ...scopeAttrs(scope, "content", instance),
        ...contentPlacementProps(input.placement),
        id: ids.content,
        role: "dialog",
        tabindex: -1,
        "aria-modal": input.modal ? "true" : undefined,
        "aria-label": own.label,
        "aria-labelledby": labelledBy,
        "aria-describedby": join(own.describedBy, input.rendered.description),
        "data-state": dataState,
        "data-modal": dataFlag(input.modal),
        "data-close-reason": closeReason,
        "data-focus-within": dataFlag(input.focusWithin === true),
        ...focusAttrs(input.contentFocused === true, input.modality ?? "keyboard"),
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
    arrow: (): PartProps => ({
      ...scopeAttrs(scope, "arrow", instance),
      ...arrowProps(input.placement, ids.arrow),
    }),
    title: (own: { level: HeadingLevel; tag: string }): PartProps => ({
      ...scopeAttrs(scope, "title", instance),
      ...headingProps({ level: own.level, tag: own.tag }),
      id: ids.title,
    }),
    description: (): PartProps => ({
      ...scopeAttrs(scope, "description", instance),
      id: ids.description,
    }),
    closeTrigger: (s: PopoverButtonState & { readonly empty: boolean }): PartProps => ({
      ...scopeAttrs(scope, "close-trigger", instance),
      type: "button",
      "aria-label": s.empty ? input.messages.close : undefined,
      ...focusAttrs(s.focused, s.modality),
      "data-pressed": dataFlag(s.pressed),
    }),
    /** Press handlers: the adapter wires them through press interactions. */
    pressTrigger: (modality: Modality) => send({ type: "trigger", modality }),
    pressClose: (modality: Modality) => send({ type: "close-trigger", modality }),
    reposition: () => send({ type: "POSITION.REPOSITION" }),
  }
}
