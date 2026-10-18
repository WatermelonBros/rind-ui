// Popover (design §1): two states and a controllable `open`. Everything that touches the DOM
// is injected infrastructure in one effect: the layer (dismiss, inert and scroll lock when
// modal), positioning, the non-modal Tab order and initial focus — which waits for the first
// placement, so the page never scrolls to an unplaced popup. The close events are named
// after the close reasons: `onOpenChange`'s `details.reason` is the reason itself.

import type { Modality } from "../../contract/env"
import type { DismissRequest } from "../../dom/dismiss"
import { deepActiveElement, type FocusTarget, focusInitial } from "../../dom/focus-scope"
import { getLayerStack, type LayerId, layerId } from "../../dom/layer-stack"
import { trackNonModalTabOrder } from "../../dom/non-modal-tab-order"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { DomEnvironment } from "../../env/dom-environment"
import type {
  Align,
  PositionEnv,
  PositioningOptions,
  PositioningProps,
  Side,
} from "../../env/position"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

declare const process: { env: { NODE_ENV?: string } }

type Dismissal<K extends string> = { readonly type: K; readonly request: DismissRequest }

export type PopoverEvent =
  /** The trigger was pressed: opens a closed popover, closes an open one. */
  | { readonly type: "trigger"; readonly modality: Modality }
  | { readonly type: "close-trigger"; readonly modality: Modality }
  | Dismissal<"escape-key">
  | Dismissal<"outside-press">
  | Dismissal<"outside-focus">
  | Dismissal<"parent-dismissed">
  /** The content committed a choice and closes (a date picker's pick). */
  | { readonly type: "select"; readonly modality: Modality }
  /** Programmatic open (`actionsRef`). */
  | { readonly type: "open" }
  /** Programmatic close (`close: true`), or the `disabled` prop changed (closes when set). */
  | { readonly type: "api"; readonly close?: true }
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }
  | { readonly type: "POSITION.REPOSITION" }

export type PopoverCloseReason =
  | "trigger"
  | "close-trigger"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "select"
  | "api"

const CLOSE_REASONS = new Set<string>([
  "trigger",
  "close-trigger",
  "escape-key",
  "outside-press",
  "outside-focus",
  "parent-dismissed",
  "select",
  "api",
] satisfies PopoverCloseReason[])

/** A cancellable event passed to `onEscapeKeyDown` / `onInteractOutside`. */
export interface PopoverDismissEvent {
  readonly event: Event | undefined
  readonly target: Element | null
  preventDefault(): void
}

export interface PopoverProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<PopoverEvent>) => void)
    | undefined
  /** Default false. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Default true. */
  readonly closeOnEscape?: boolean | undefined
  /** Default true. */
  readonly closeOnInteractOutside?: boolean | undefined
  readonly onEscapeKeyDown?: ((event: PopoverDismissEvent) => void) | undefined
  readonly onInteractOutside?: ((event: PopoverDismissEvent) => void) | undefined
  /** Elements whose presses and focus count as inside (a toast). */
  readonly persistentElements?: (() => readonly Element[]) | undefined
  /** `false`: focus stays; `null` or a function returning null: the default rule. */
  readonly initialFocus?: (() => FocusTarget) | null | undefined
  /** `false`: focus does not move back; `null`: the trigger. */
  readonly finalFocus?:
    | ((reason: PopoverCloseReason | undefined) => FocusTarget)
    | null
    | false
    | undefined
  readonly positioning?: PositioningProps | undefined
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** The nearest layer this one was opened from (the adapter's layer context). */
  readonly parent?: LayerId | undefined
  /** An Anchor part is rendered: positioning and inside-ness use it. */
  readonly anchored?: boolean | undefined
  /** The parts' `data-scope` (a composite re-scopes them). */
  readonly scope?: string | undefined
}

export interface PopoverContext {
  readonly placement: PlacementState
  /** The last close reason, until the next open (`data-close-reason`). */
  readonly closeReason: PopoverCloseReason | null
}

export const popoverIds = (root: string, scope = "popover") => ({
  trigger: partId(scope, root, "trigger"),
  anchor: partId(scope, root, "anchor"),
  positioner: partId(scope, root, "positioner"),
  content: partId(scope, root, "content"),
  arrow: partId(scope, root, "arrow"),
  title: partId(scope, root, "title"),
  description: partId(scope, root, "description"),
})

export const popoverLayerId = (root: string) => layerId(`popover-${root}`)

/** The popup preset with an 8 px gap, under the consumer's options. */
export const popoverPositioning = (props: Pick<PopoverProps, "positioning">): PositioningOptions =>
  resolvePositioning(props.positioning, { ...positioningPresets.popup, sideOffset: 8 })

const initialPlacement = (props: PopoverProps) => {
  const o = popoverPositioning(props)
  // The requested side until placed (inline sides resolve on placement).
  const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
  return unplaced(side, o.align)
}

export const popoverMachine = setup({
  types: type<{
    props: PopoverProps
    events: PopoverEvent
    env: DomEnvironment & PositionEnv
    context: PopoverContext
    values: "open"
  }>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
    closesOnEscape: ({ props }) => props.closeOnEscape !== false,
    closesOnOutsidePress: ({ props }) => props.closeOnInteractOutside !== false,
    /** A programmatic close, or the popover became disabled. */
    apiCloses: ({ event, props }) =>
      event.type === "api" && (event.close === true || props.disabled === true),
  },
  actions: {
    enterOpen: ({ props, set }) => {
      set("closeReason", null)
      set("placement", initialPlacement(props))
    },
    // On the close transition, and on exit for a controlled parent applying the proposal.
    setCloseReason: ({ event, set }) => {
      if (CLOSE_REASONS.has(event.type)) set("closeReason", event.type as PopoverCloseReason)
    },
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
    reposition: ({ env, props }) =>
      env.position.reposition(popoverIds(props.root, props.scope).positioner),
  },
  effects: {
    /**
     * The layer and its focus rules, positioning and the non-modal Tab order. Initial focus
     * runs on the first placement (overlay's own initial focus is off).
     */
    overlay: (a) => {
      const { env, send } = a
      if (typeof document === "undefined") return undefined
      const ids = popoverIds(a.props.root, a.props.scope)
      const byId = (id: string) => env.dom.getById(id)
      const content = () => byId(ids.content) as HTMLElement | null
      const trigger = () => byId(ids.trigger) as HTMLElement | null
      const modal = a.props.modal === true
      const id = popoverLayerId(a.props.root)
      const root = env.dom.getRootNode()
      const doc = "body" in root ? root : root.ownerDocument
      const focusAtOpen = deepActiveElement(doc)
      let closed = false
      const veto = (handler: ((e: PopoverDismissEvent) => void) | undefined, r: DismissRequest) => {
        let prevented = false
        handler?.({ event: r.event, target: r.target, preventDefault: () => (prevented = true) })
        return prevented
      }
      const final = a.props.finalFocus
      const stopOverlay = overlayEffect(env, {
        id,
        kind: "popover",
        family: "popover",
        modal,
        parent: a.props.parent,
        opener: trigger,
        // The trigger and the anchor are inside: pressing the trigger toggles once
        // (headlessui#2713); another popover's trigger is outside (zag#2241).
        // Modal: the trigger is inert with the rest of the page, so it is not inside.
        elements: () =>
          [modal ? null : trigger(), byId(ids.anchor), byId(ids.positioner), content()].filter(
            (e): e is HTMLElement => e !== null,
          ),
        container: content,
        initialFocus: () => false,
        modality: env.modality.modality(),
        ...(final === null || final === undefined
          ? {}
          : {
              finalFocus:
                final === false ? () => false : () => final(a.context.closeReason ?? undefined),
            }),
        dismiss: {
          escape: a.props.closeOnEscape !== false,
          outsidePress: a.props.closeOnInteractOutside !== false,
          outsideFocus: !modal,
          isInside: (target) =>
            (a.props.persistentElements?.() ?? []).some((el) => el.contains(target)),
          onRequest: (request) => {
            const handler =
              request.reason === "escape-key"
                ? a.props.onEscapeKeyDown
                : request.reason === "parent-dismissed"
                  ? undefined
                  : a.props.onInteractOutside
            if (veto(handler, request)) {
              request.cancel()
              return
            }
            send({ type: request.reason, request } as PopoverEvent) // the reason is the event type
            // A controlled parent that kept it open vetoes: nothing beneath is dismissed.
            if (!closed) request.cancel()
          },
        },
      })
      const layer = getLayerStack(doc).get(id)
      const stopTabOrder =
        modal || !layer ? () => {} : trackNonModalTabOrder(env, { trigger, content, layer })
      const openModality = env.modality.modality()
      let cancelFocus = () => {}
      const track = env.position.track({
        anchor: { kind: "element", id: a.props.anchored ? ids.anchor : ids.trigger },
        positioner: ids.positioner,
        arrow: ids.arrow,
        options: () => popoverPositioning(a.props),
        onPlacement: (p, first) => {
          send({ type: "POSITION.PLACED", ...p, first })
          const el = content()
          if (!first || !el) return
          // A child popover opened in the same render takes focus: the parent does not
          // steal it back (react-spectrum#10662).
          const stack = getLayerStack(doc)
          const hasChild = stack.layers().some((l) => {
            let p = l.parentId
            while (p && p !== id) p = stack.get(p)?.parentId
            return p === id
          })
          if (hasChild) return
          // Placed before focus: focusing an unplaced popup scrolls the page (base-ui#4520).
          const pick = a.props.initialFocus
          cancelFocus = focusInitial(env, el, pick ?? undefined, openModality, focusAtOpen)
        },
      })
      return () => {
        closed = true
        cancelFocus()
        track.stop()
        stopTabOrder()
        stopOverlay()
      }
    },
    /** A modal popover without a close trigger: touch screen-reader users have no Escape. */
    modalCheck: (a) => {
      const { env, props } = a
      if (process.env.NODE_ENV === "production" || props.modal !== true) return undefined
      const ids = popoverIds(props.root, props.scope)
      const frame = env.scheduler.requestAnimationFrame(() => {
        const el = env.dom.getById(ids.content)
        if (!el) return
        if (!el.querySelector('[data-part="close-trigger"]')) {
          console.warn(
            `[rind-ui] popover: modal #${el.id} has no Popover.CloseTrigger; touch screen-reader users have no Escape key`,
          )
        }
        if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
          console.error(
            `[rind-ui] popover: modal #${el.id} has no accessible name; render Popover.Title or pass aria-label`,
          )
        }
      })
      return () => env.scheduler.cancelAnimationFrame(frame)
    },
  },
}).machine({
  id: "popover",
  initial: "closed",
  context: (props) => ({ placement: initialPlacement(props), closeReason: null }),
  values: { open: { fallback: false, states: { open: true, closed: false } } },
  onProps: { disabled: "api" },
  states: {
    closed: {
      on: {
        trigger: { guard: "enabled", target: "open" },
        open: { guard: "enabled", target: "open" },
      },
    },
    open: {
      entry: ["enterOpen"],
      exit: ["setCloseReason"],
      effects: ["overlay", "modalCheck"],
      on: {
        trigger: { target: "closed", actions: ["setCloseReason"] },
        "close-trigger": { target: "closed", actions: ["setCloseReason"] },
        "escape-key": { guard: "closesOnEscape", target: "closed", actions: ["setCloseReason"] },
        "outside-press": {
          guard: "closesOnOutsidePress",
          target: "closed",
          actions: ["setCloseReason"],
        },
        "outside-focus": { target: "closed", actions: ["setCloseReason"] },
        "parent-dismissed": { target: "closed", actions: ["setCloseReason"] },
        select: { target: "closed", actions: ["setCloseReason"] },
        api: { guard: "apiCloses", target: "closed", actions: ["setCloseReason"] },
        "POSITION.PLACED": { actions: ["setPlacement"] },
        "POSITION.REPOSITION": { actions: ["reposition"] },
      },
    },
  },
})

export type PopoverMachine = typeof popoverMachine
