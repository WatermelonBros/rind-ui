// Hover Card (design §1): Tooltip's shape — closed → opening → open → closing, delays as
// `after` transitions on the injected scheduler — with a preview's focus rules: focus inside
// the content, a keyboard-focused trigger or an open child layer keep it open; it takes no
// initial focus and sits in the Tab order right after its trigger. The layer, hover zone,
// Tab order and positioning live in one session across open ↔ closing.

import type { FocusCause } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import { getLayerStack, type LayerId, layerId } from "../../dom/layer-stack"
import { trackNonModalTabOrder } from "../../dom/non-modal-tab-order"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { DomEnvironment } from "../../env/dom-environment"
import type { HoverIntentEnv } from "../../env/hover-intent"
import type {
  Align,
  PositionEnv,
  PositioningOptions,
  PositioningProps,
  Side,
} from "../../env/position"
import { partId } from "../../ids"
import { session } from "../../machine/session"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type HoverCardCloseReason =
  | "pointer-leave"
  | "blur"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "parent-dismissed"
  | "disabled"
  | "api"
export type HoverCardOpenReason = "hover" | "focus" | "api"

export type HoverCardEvent =
  /** `zone`: from the open card's hover tracking; otherwise the trigger's own handlers. */
  | { readonly type: "HOVER.START"; readonly zone?: true }
  | { readonly type: "HOVER.END"; readonly zone?: true }
  | { readonly type: "FOCUS"; readonly modality: Modality; readonly cause: FocusCause }
  | { readonly type: "BLUR" }
  /** Focus entered or left the content (or its descendant layers). */
  | { readonly type: "FOCUS_WITHIN.ENTER" }
  | { readonly type: "FOCUS_WITHIN.LEAVE" }
  /** The layer's dismissals (the event is named after the reason). */
  | { readonly type: "ESCAPE_KEY" }
  | { readonly type: "OUTSIDE_PRESS" }
  | { readonly type: "OUTSIDE_FOCUS" }
  | { readonly type: "PARENT_DISMISSED" }
  /** Programmatic (`actionsRef.close`). */
  | { readonly type: "CLOSE" }
  /** Programmatic (`actionsRef`). */
  | { readonly type: "OPEN" }
  /** The `disabled` prop changed (closes when it became true). */
  | { readonly type: "DISABLED" }
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }

/** `onOpenChange`'s details: `reason` is why it opens or closes. */
export type HoverCardChangeDetails = Omit<ChangeDetails<HoverCardEvent>, "reason"> & {
  readonly reason: HoverCardOpenReason | HoverCardCloseReason
}

export interface HoverCardProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: HoverCardChangeDetails) => void) | undefined
  /** Default 700 ms. */
  readonly openDelay?: number | undefined
  /** Default 300 ms. */
  readonly closeDelay?: number | undefined
  readonly disabled?: boolean | undefined
  readonly positioning?: PositioningProps | undefined
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** The layer the trigger is in (the adapter's layer context). */
  readonly parent?: LayerId | undefined
  /** The trigger element (a rind-ui part used as the trigger keeps its own id). */
  readonly getTrigger?: (() => HTMLElement | null) | undefined
}

export interface HoverCardContext {
  readonly placement: PlacementState
  /** The trigger has focus that came from the keyboard. */
  readonly keyboardFocused: boolean
  /** The pointer is in the hover zone (trigger, content, grace area). */
  readonly pointerInZone: boolean
  /** Focus is inside the content or one of its descendant layers. */
  readonly focusInside: boolean
  readonly closeReason: HoverCardCloseReason | null
  /** Why it is closing: the reason the close delay reports. */
  readonly leaving: "pointer-leave" | "blur"
}

export const hoverCardIds = (root: string) => ({
  trigger: partId("hover-card", root, "trigger"),
  positioner: partId("hover-card", root, "positioner"),
  content: partId("hover-card", root, "content"),
  arrow: partId("hover-card", root, "arrow"),
})

export const hoverCardLayerId = (root: string) => layerId(`hover-card-${root}`)

/** The popup preset, below, 8 px away with 8 px collision padding, under the consumer's. */
export const hoverCardPositioning = (
  props: Pick<HoverCardProps, "positioning">,
): PositioningOptions =>
  resolvePositioning(props.positioning, {
    ...positioningPresets.popup,
    side: "bottom",
    sideOffset: 8,
    collisionPadding: 8,
  })

const initialPlacement = (props: HoverCardProps) => {
  const o = hoverCardPositioning(props)
  const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
  return unplaced(side, o.align)
}

type Env = DomEnvironment & PositionEnv & HoverIntentEnv

const CLOSE_REASON = {
  ESCAPE_KEY: "escape-key",
  OUTSIDE_PRESS: "outside-press",
  OUTSIDE_FOCUS: "outside-focus",
  PARENT_DISMISSED: "parent-dismissed",
  CLOSE: "api",
} as const satisfies Record<string, HoverCardCloseReason>

const DISMISSAL = {
  "escape-key": "ESCAPE_KEY",
  "outside-press": "OUTSIDE_PRESS",
  "outside-focus": "OUTSIDE_FOCUS",
  "parent-dismissed": "PARENT_DISMISSED",
} as const

/** Focus from Tab or a key-driven move by rind-ui: never a layer's, the window's or AT's. */
const isKeyboardIntent = (e: { readonly type: string }) =>
  e.type === "FOCUS" &&
  "modality" in e &&
  "cause" in e &&
  e.modality === "keyboard" &&
  (e.cause === "key" || e.cause === "navigation")

/**
 * A layer opened from this card (a popover, a select, a nested card) is open. Any family:
 * the stack's `hasNested` counts only the card's own family.
 */
const childOpen = (env: Env, props: HoverCardProps) => {
  if (typeof document === "undefined") return false
  const stack = getLayerStack(docOf(env))
  const id = hoverCardLayerId(props.root)
  return stack.layers().some((layer) => {
    for (let p = layer.parentId; p !== undefined; p = stack.get(p)?.parentId) {
      if (p === id) return true
    }
    return false
  })
}

const docOf = (env: Env) => {
  const node = env.dom.getRootNode()
  return "body" in node ? node : node.ownerDocument
}

export const hoverCardMachine = /* @__PURE__ */ setup({
  types: type<{
    props: HoverCardProps
    events: HoverCardEvent
    env: Env
    context: HoverCardContext
    values: "open"
  }>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
    keyboardIntent: ({ event }) => isKeyboardIntent(event),
    fromZone: ({ event }) => "zone" in event && event.zone === true,
    keyboardFocused: ({ context }) => context.keyboardFocused,
    pointerInZone: ({ context }) => context.pointerInZone,
    becameDisabled: ({ props }) => props.disabled === true,
    leavingByBlur: ({ context }) => context.leaving === "blur",
    /** Focus inside, a keyboard-focused trigger or an open descendant layer keep it open. */
    held: ({ context, env, props }) =>
      context.focusInside || context.keyboardFocused || childOpen(env, props),
    /** On the trigger's blur: its keyboard focus is what is ending, so it holds nothing. */
    heldInside: ({ context, env, props }) => context.focusInside || childOpen(env, props),
    /** Focus moved into a portalled child layer (a popover opened from the card). */
    childLayerOpen: ({ env, props }) => childOpen(env, props),
  },
  actions: {
    hovered: ({ set }) => set("pointerInZone", true),
    unhovered: ({ set }) => set("pointerInZone", false),
    keyboardFocus: ({ event, set }) => set("keyboardFocused", isKeyboardIntent(event)),
    blurred: ({ set }) => set("keyboardFocused", false),
    focusEntered: ({ set }) => set("focusInside", true),
    focusLeft: ({ set }) => set("focusInside", false),
    setCloseReason: ({ event, set }) => {
      const reason = CLOSE_REASON[event.type as keyof typeof CLOSE_REASON]
      if (reason) set("closeReason", reason)
    },
    clearCloseReason: ({ set }) => set("closeReason", null),
    leaveByPointer: ({ set }) => set("leaving", "pointer-leave"),
    leaveByBlur: ({ set }) => set("leaving", "blur"),
    // Leaving `closed` only: closing → open keeps the session and its placement.
    resetPlacement: ({ props, set }) => set("placement", initialPlacement(props)),
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
  },
  delays: {
    openDelay: ({ props }) => props.openDelay ?? 700,
    closeDelay: ({ props }) => props.closeDelay ?? 300,
  },
  effects: {
    /** While open or closing: the layer, the hover zone, the Tab order, placement. */
    shown: (a) => {
      const { env } = a
      if (typeof document === "undefined") return undefined
      const root = a.props.root
      const ids = hoverCardIds(root)
      return session<typeof a, HoverCardEvent>(
        `hover-card:${root}`,
        a,
        (s) => {
          const send = (e: HoverCardEvent) => s.owner.send(e)
          const props = () => s.owner.props
          const byId = (id: string) => env.dom.getById(id)
          const trigger = () => props().getTrigger?.() ?? byId(ids.trigger)
          const content = () => byId(ids.content)
          const elements = () =>
            [byId(ids.positioner), content()].filter((e): e is HTMLElement => e !== null)
          const id = hoverCardLayerId(root)
          const doc = docOf(env)
          const stopLayer = overlayEffect(env, {
            id,
            kind: "popover",
            family: "hover-card",
            modal: false,
            parent: props().parent,
            opener: trigger,
            // The trigger is inside: hovering or pressing it is not outside.
            elements: () => [trigger(), ...elements()].filter((e) => e !== null),
            container: content,
            // A preview: opening never moves focus.
            initialFocus: () => false,
            modality: env.modality.modality(),
            dismiss: {
              escape: true,
              outsidePress: true,
              outsideFocus: true,
              onRequest: (request) => send({ type: DISMISSAL[request.reason] }),
            },
          })
          const layer = getLayerStack(doc).get(id)
          const stopHover = layer
            ? env.hoverIntent.track({
                trigger,
                elements,
                layer,
                onLeave: () => send({ type: "HOVER.END", zone: true }),
                onEnter: () => send({ type: "HOVER.START", zone: true }),
              })
            : () => {}
          const stopTabOrder = layer
            ? trackNonModalTabOrder(env, { trigger, content, layer })
            : () => {}
          const track = env.position.track({
            // By reference: the trigger may carry another part's id.
            anchor: {
              kind: "virtual",
              get: () => {
                const el = trigger()
                return el
                  ? { getBoundingClientRect: () => el.getBoundingClientRect(), contextElement: el }
                  : null
              },
            },
            positioner: ids.positioner,
            arrow: ids.arrow,
            options: () => hoverCardPositioning(props()),
            onPlacement: (p, first) => {
              s.placed = { type: "POSITION.PLACED", ...p, first: true }
              send({ type: "POSITION.PLACED", ...p, first })
            },
          })
          return () => {
            track.stop()
            stopTabOrder()
            stopHover()
            stopLayer()
          }
        },
        (s) => {
          if (s.placed) s.owner.send(s.placed)
        },
      )
    },
  },
}).machine({
  id: "hover-card",
  initial: "closed",
  context: (props) => ({
    placement: initialPlacement(props),
    keyboardFocused: false,
    pointerInZone: false,
    focusInside: false,
    closeReason: null,
    leaving: "pointer-leave",
  }),
  values: {
    open: { fallback: false, states: { open: true, closing: true, closed: false, opening: false } },
  },
  onProps: { disabled: "DISABLED" },
  on: {
    BLUR: { actions: ["blurred"] },
    "FOCUS_WITHIN.ENTER": { actions: ["focusEntered"] },
  },
  states: {
    closed: {
      exit: ["resetPlacement", "clearCloseReason"],
      on: {
        "HOVER.START": [
          { guard: { or: ["fromZone", { not: "enabled" }] } },
          { target: "opening", actions: ["hovered"] },
        ],
        "HOVER.END": { actions: ["unhovered"] },
        FOCUS: [
          {
            guard: { and: ["enabled", "keyboardIntent"] },
            target: "opening",
            actions: ["keyboardFocus"],
          },
          { actions: ["keyboardFocus"] },
        ],
        "FOCUS_WITHIN.LEAVE": { actions: ["focusLeft"] },
        OPEN: { guard: "enabled", target: "open", reason: "api" },
      },
    },
    opening: {
      after: {
        openDelay: [
          { guard: "keyboardFocused", target: "open", reason: "focus" },
          { target: "open", reason: "hover" },
        ],
      },
      on: {
        // The pointer arriving while a focus open is pending: it is in the zone now.
        "HOVER.START": { actions: ["hovered"] },
        // Leaving cancels a hover open, not a keyboard one (design §1).
        "HOVER.END": [
          { guard: "fromZone" },
          { guard: "keyboardFocused", actions: ["unhovered"] },
          { target: "closed", actions: ["unhovered"] },
        ],
        FOCUS: { actions: ["keyboardFocus"] },
        BLUR: [
          { guard: "pointerInZone", actions: ["blurred"] },
          { target: "closed", actions: ["blurred"] },
        ],
        "FOCUS_WITHIN.LEAVE": { actions: ["focusLeft"] },
        OPEN: { target: "open", reason: "api" },
        CLOSE: { target: "closed", actions: ["setCloseReason"] },
        DISABLED: { guard: "becameDisabled", target: "closed" },
      },
    },
    open: {
      effects: ["shown"],
      on: {
        "HOVER.START": { actions: ["hovered"] },
        "HOVER.END": [
          { guard: { not: "fromZone" } },
          { guard: "held", actions: ["unhovered"] },
          { target: "closing", actions: ["unhovered", "leaveByPointer"] },
        ],
        FOCUS: { actions: ["keyboardFocus"] },
        BLUR: [
          { guard: "pointerInZone", actions: ["blurred"] },
          { guard: "heldInside", actions: ["blurred"] },
          { target: "closing", actions: ["blurred", "leaveByBlur"] },
        ],
        "FOCUS_WITHIN.LEAVE": [
          {
            guard: { or: ["pointerInZone", "keyboardFocused", "childLayerOpen"] },
            actions: ["focusLeft"],
          },
          { target: "closing", actions: ["focusLeft", "leaveByBlur"] },
        ],
        ESCAPE_KEY: { target: "closed", reason: "escape-key", actions: ["setCloseReason"] },
        OUTSIDE_PRESS: { target: "closed", reason: "outside-press", actions: ["setCloseReason"] },
        OUTSIDE_FOCUS: { target: "closed", reason: "outside-focus", actions: ["setCloseReason"] },
        PARENT_DISMISSED: {
          target: "closed",
          reason: "parent-dismissed",
          actions: ["setCloseReason"],
        },
        CLOSE: { target: "closed", reason: "api", actions: ["setCloseReason"] },
        DISABLED: { guard: "becameDisabled", target: "closed", reason: "disabled" },
        "POSITION.PLACED": { actions: ["setPlacement"] },
      },
    },
    closing: {
      effects: ["shown"],
      after: {
        closeDelay: [
          { guard: "leavingByBlur", target: "closed", reason: "blur" },
          { target: "closed", reason: "pointer-leave" },
        ],
      },
      on: {
        "HOVER.START": { target: "open", actions: ["hovered"] },
        FOCUS: [
          { guard: "keyboardIntent", target: "open", actions: ["keyboardFocus"] },
          { actions: ["keyboardFocus"] },
        ],
        "FOCUS_WITHIN.ENTER": { target: "open", actions: ["focusEntered"] },
        "FOCUS_WITHIN.LEAVE": { actions: ["focusLeft"] },
        BLUR: { actions: ["blurred"] },
        ESCAPE_KEY: { target: "closed", reason: "escape-key", actions: ["setCloseReason"] },
        OUTSIDE_PRESS: { target: "closed", reason: "outside-press", actions: ["setCloseReason"] },
        OUTSIDE_FOCUS: { target: "closed", reason: "outside-focus", actions: ["setCloseReason"] },
        PARENT_DISMISSED: {
          target: "closed",
          reason: "parent-dismissed",
          actions: ["setCloseReason"],
        },
        CLOSE: { target: "closed", reason: "api", actions: ["setCloseReason"] },
        DISABLED: { guard: "becameDisabled", target: "closed", reason: "disabled" },
        "POSITION.PLACED": { actions: ["setPlacement"] },
      },
    },
  },
})

export type HoverCardMachine = typeof hoverCardMachine
