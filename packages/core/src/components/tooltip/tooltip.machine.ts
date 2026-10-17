// Tooltip (design §1): closed → opening → open → closing, delays as `after` transitions on
// the injected scheduler so model tests drive them with fake time. A closed or opening
// tooltip holds nothing but its group membership; the layer, hover tracking and positioning
// exist only while it is open or closing (closed tooltips cost nothing). Each transition
// that changes `open` declares its reason, which `onOpenChange` receives.

import type { FocusCause } from "../../a11y/events"
import type { Modality } from "../../contract/env"
import { getLayerStack, type LayerId, layerId } from "../../dom/layer-stack"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { DelayGroupEnv } from "../../env/delay-group"
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

export type TooltipEvent =
  /** `zone`: from the open tooltip's hover tracking; otherwise the trigger's own handlers. */
  | { readonly type: "HOVER.START"; readonly zone?: true }
  | { readonly type: "HOVER.END"; readonly zone?: true }
  | { readonly type: "FOCUS"; readonly modality: Modality; readonly cause: FocusCause }
  | { readonly type: "BLUR" }
  /** `pointer`: a mouse or pen pressed it (keeps the pointer from reopening it at once). */
  | { readonly type: "PRESS.START"; readonly pointer?: true }
  | { readonly type: "ESCAPE" }
  | { readonly type: "OUTSIDE_PRESS" }
  /** Another member of the delay group opened. */
  | { readonly type: "GROUP" }
  /** The `disabled` prop changed (closes when it became true). */
  | { readonly type: "DISABLED" }
  /** Programmatic (`actionsRef`). */
  | { readonly type: "OPEN" }
  | { readonly type: "CLOSE" }
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }

export type TooltipOpenReason = "hover" | "focus" | "api"
export type TooltipCloseReason =
  | "pointer-leave"
  | "blur"
  | "escape-key"
  | "outside-press"
  | "trigger-press"
  | "group"
  | "disabled"
  | "api"

/** `onOpenChange`'s details: `reason` is why it opens or closes. */
export type TooltipChangeDetails = Omit<ChangeDetails<TooltipEvent>, "reason"> & {
  readonly reason: TooltipOpenReason | TooltipCloseReason
}

export interface TooltipProps {
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: TooltipChangeDetails) => void) | undefined
  /** Default 700 ms. */
  readonly openDelay?: number | undefined
  /** Default 300 ms. */
  readonly closeDelay?: number | undefined
  /** The delay group's warm window after this tooltip closes (default 300 ms; 0: none). */
  readonly skipDelay?: number | undefined
  /** Pressing the trigger closes it (default true). */
  readonly closeOnPress?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly positioning?: PositioningProps | undefined
  /** The instance id (part ids derive from it). */
  readonly root: string
  /** The layer the trigger is in (the adapter's layer context). */
  readonly parent?: LayerId | undefined
  /**
   * The trigger element (the adapter's ref). A rind-ui part used as the trigger keeps its own
   * id, so the tooltip finds it by reference; default: by the derived id.
   */
  readonly getTrigger?: (() => HTMLElement | null) | undefined
}

export interface TooltipContext {
  readonly placement: PlacementState
  /** The trigger has focus that came from the keyboard. */
  readonly keyboardFocused: boolean
  /** The pointer is in the hover zone (trigger, content, grace area). */
  readonly pointerInZone: boolean
  /** Set by a trigger press; cleared when the pointer leaves the trigger. */
  readonly suppressHover: boolean
  /** Opened or closed by the delay group without delay or animation. */
  readonly instant: boolean
}

export const tooltipIds = (root: string) => ({
  trigger: partId("tooltip", root, "trigger"),
  positioner: partId("tooltip", root, "positioner"),
  content: partId("tooltip", root, "content"),
  arrow: partId("tooltip", root, "arrow"),
})

export const tooltipLayerId = (root: string) => layerId(`tooltip-${root}`)

/** The popup preset, on top, 8 px away, under the consumer's options. */
export const tooltipPositioning = (props: Pick<TooltipProps, "positioning">): PositioningOptions =>
  resolvePositioning(props.positioning, {
    ...positioningPresets.popup,
    side: "top",
    sideOffset: 8,
  })

const initialPlacement = (props: TooltipProps) => {
  const o = tooltipPositioning(props)
  const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
  return unplaced(side, o.align)
}

type Env = DomEnvironment & PositionEnv & HoverIntentEnv & DelayGroupEnv

const isKeyboardIntent = (e: { readonly type: string }) =>
  e.type === "FOCUS" &&
  "modality" in e &&
  "cause" in e &&
  e.modality === "keyboard" &&
  (e.cause === "key" || e.cause === "navigation")

export const tooltipMachine = setup({
  types: type<{
    props: TooltipProps
    events: TooltipEvent
    env: Env
    context: TooltipContext
    values: "open"
  }>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
    /** Focus from Tab or a key-driven move by rind-ui, never a layer's or the window's. */
    keyboardIntent: ({ event }) => isKeyboardIntent(event),
    // A skip delay of 0 opts this tooltip out of instant opens (radix#3873).
    groupWarm: ({ env, props }) => (props.skipDelay ?? 300) > 0 && env.delayGroup.isWarm(),
    suppressed: ({ context }) => context.suppressHover,
    fromZone: ({ event }) => "zone" in event && event.zone === true,
    keyboardFocused: ({ context }) => context.keyboardFocused,
    pointerInZone: ({ context }) => context.pointerInZone,
    closeOnPress: ({ props }) => props.closeOnPress !== false,
    becameDisabled: ({ props }) => props.disabled === true,
  },
  actions: {
    hovered: ({ set }) => set("pointerInZone", true),
    unhovered: ({ set }) => set("pointerInZone", false),
    keyboardFocus: ({ event, set }) => set("keyboardFocused", isKeyboardIntent(event)),
    blurred: ({ set }) => set("keyboardFocused", false),
    // Only a mouse or pen press: a tap or a key leaves no hovering pointer to suppress.
    suppress: ({ event, set }) => {
      if (event.type === "PRESS.START" && event.pointer === true) set("suppressHover", true)
    },
    unsuppress: ({ set }) => set("suppressHover", false),
    instant: ({ set }) => set("instant", true),
    notInstant: ({ set }) => set("instant", false),
    enterOpen: ({ env, props }) => env.delayGroup.opened(props.root),
    // Leaving `closed` only: closing → open keeps the session and its placement.
    resetPlacement: ({ props, set }) => set("placement", initialPlacement(props)),
    groupClosed: ({ env, props }) => env.delayGroup.closed(props.root, props.skipDelay ?? 300),
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
  },
  delays: {
    openDelay: ({ props }) => props.openDelay ?? 700,
    closeDelay: ({ props }) => props.closeDelay ?? 300,
  },
  effects: {
    /** Group membership for the whole life of the service (zag#3390). */
    membership: ({ env, props, send }) => {
      const leave = env.delayGroup.join(props.root, { replace: () => send({ type: "GROUP" }) })
      return () => leave(props.skipDelay ?? 300)
    },
    /** While open or closing: the layer (Escape, outside press), hover zone, placement. */
    shown: (a) => {
      const { env } = a
      if (typeof document === "undefined") return undefined
      const root = a.props.root
      const ids = tooltipIds(root)
      return session<typeof a, TooltipEvent>(
        `tooltip:${root}`,
        a,
        (s) => {
          const send = (e: TooltipEvent) => s.owner.send(e)
          const props = () => s.owner.props
          const byId = (id: string) => env.dom.getById(id)
          const trigger = () => props().getTrigger?.() ?? byId(ids.trigger)
          const elements = () =>
            [byId(ids.positioner), byId(ids.content)].filter((e): e is HTMLElement => e !== null)
          const id = tooltipLayerId(root)
          const node = env.dom.getRootNode()
          const doc = "body" in node ? node : node.ownerDocument
          const stopLayer = overlayEffect(env, {
            id,
            kind: "tooltip",
            modal: false,
            parent: props().parent,
            opener: trigger,
            elements: () => [trigger(), ...elements()].filter((e) => e !== null),
            container: () => byId(ids.content),
            // Never focused, never moves focus back.
            initialFocus: () => false,
            finalFocus: () => false,
            modality: env.modality.modality(),
            dismiss: {
              escape: true,
              outsidePress: true,
              // Focus leaving is the BLUR rule's, not outside-focus dismissal.
              outsideFocus: false,
              onRequest: (request) => {
                if (request.reason === "escape-key") send({ type: "ESCAPE" })
                else if (request.reason === "outside-press") send({ type: "OUTSIDE_PRESS" })
                else request.cancel()
              },
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
            options: () => tooltipPositioning(props()),
            onPlacement: (p, first) => {
              s.placed = { type: "POSITION.PLACED", ...p, first: true }
              send({ type: "POSITION.PLACED", ...p, first })
            },
          })
          return () => {
            track.stop()
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
  id: "tooltip",
  initial: "closed",
  context: (props) => ({
    placement: initialPlacement(props),
    keyboardFocused: false,
    pointerInZone: false,
    suppressHover: false,
    instant: false,
  }),
  values: {
    open: { fallback: false, states: { open: true, closing: true, closed: false, opening: false } },
  },
  onProps: { disabled: "DISABLED" },
  effects: ["membership"],
  on: {
    BLUR: { actions: ["blurred"] },
  },
  states: {
    closed: {
      entry: ["groupClosed"],
      exit: ["resetPlacement"],
      on: {
        "HOVER.START": [
          { guard: { or: ["fromZone", { not: "enabled" }, "suppressed"] } },
          {
            guard: "groupWarm",
            target: "open",
            reason: "hover",
            actions: ["hovered", "instant"],
          },
          { target: "opening", actions: ["hovered", "notInstant"] },
        ],
        "HOVER.END": { actions: ["unhovered", "unsuppress"] },
        FOCUS: [
          {
            guard: { and: ["enabled", "keyboardIntent"] },
            target: "open",
            reason: "focus",
            actions: ["keyboardFocus", "notInstant"],
          },
          { actions: ["keyboardFocus"] },
        ],
        "PRESS.START": { actions: ["suppress"] },
        OPEN: { guard: "enabled", target: "open", reason: "api", actions: ["notInstant"] },
      },
    },
    opening: {
      after: { openDelay: { target: "open", reason: "hover", actions: ["notInstant"] } },
      on: {
        "HOVER.END": {
          guard: { not: "fromZone" },
          target: "closed",
          actions: ["unhovered", "unsuppress"],
        },
        FOCUS: [
          {
            guard: "keyboardIntent",
            target: "open",
            reason: "focus",
            actions: ["keyboardFocus", "notInstant"],
          },
          { actions: ["keyboardFocus"] },
        ],
        "PRESS.START": { target: "closed", actions: ["suppress"] },
        OPEN: { target: "open", reason: "api" },
        CLOSE: "closed",
        DISABLED: { guard: "becameDisabled", target: "closed" },
      },
    },
    open: {
      entry: ["enterOpen"],
      effects: ["shown"],
      on: {
        "HOVER.START": { actions: ["hovered"] },
        "HOVER.END": [
          { guard: { not: "fromZone" } },
          { guard: "keyboardFocused", actions: ["unhovered"] },
          { target: "closing", actions: ["unhovered"] },
        ],
        FOCUS: { actions: ["keyboardFocus"] },
        BLUR: [
          { guard: "pointerInZone", actions: ["blurred"] },
          { target: "closed", reason: "blur", actions: ["blurred", "notInstant"] },
        ],
        "PRESS.START": {
          guard: "closeOnPress",
          target: "closed",
          reason: "trigger-press",
          actions: ["suppress", "notInstant"],
        },
        ESCAPE: { target: "closed", reason: "escape-key", actions: ["notInstant"] },
        OUTSIDE_PRESS: { target: "closed", reason: "outside-press", actions: ["notInstant"] },
        GROUP: { target: "closed", reason: "group", actions: ["instant"] },
        DISABLED: { guard: "becameDisabled", target: "closed", reason: "disabled" },
        CLOSE: { target: "closed", reason: "api", actions: ["notInstant"] },
        "POSITION.PLACED": { actions: ["setPlacement"] },
      },
    },
    closing: {
      effects: ["shown"],
      after: { closeDelay: { target: "closed", reason: "pointer-leave", actions: ["notInstant"] } },
      on: {
        "HOVER.START": { target: "open", actions: ["hovered"] },
        FOCUS: [
          { guard: "keyboardIntent", target: "open", actions: ["keyboardFocus"] },
          { actions: ["keyboardFocus"] },
        ],
        BLUR: { target: "closed", reason: "blur", actions: ["blurred", "notInstant"] },
        "PRESS.START": {
          guard: "closeOnPress",
          target: "closed",
          reason: "trigger-press",
          actions: ["suppress", "notInstant"],
        },
        ESCAPE: { target: "closed", reason: "escape-key", actions: ["notInstant"] },
        OUTSIDE_PRESS: { target: "closed", reason: "outside-press", actions: ["notInstant"] },
        GROUP: { target: "closed", reason: "group", actions: ["instant"] },
        DISABLED: { guard: "becameDisabled", target: "closed", reason: "disabled" },
        CLOSE: { target: "closed", reason: "api", actions: ["notInstant"] },
        "POSITION.PLACED": { actions: ["setPlacement"] },
      },
    },
  },
})

export type TooltipMachine = typeof tooltipMachine
