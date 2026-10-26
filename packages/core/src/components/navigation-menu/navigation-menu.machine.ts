// Navigation Menu (design §1): one service per level. closed → opening → open → closing →
// warm → closed, the delays as `after` transitions on the injected scheduler. `value` (the
// open item's key or null) is what is open; the states decide how hover, presses and the
// delays act on it. While open or closing one session holds the layer (dismissal, focus
// restore), the hover zone and the positioning; the Tab order follows the open trigger and
// is restarted on every switch.

import type { Modality } from "../../contract/env"
import type { DismissReason } from "../../dom/dismiss"
import { focusSafely } from "../../dom/focus-safely"
import { getLayerStack, type LayerHandle, type LayerId, layerId } from "../../dom/layer-stack"
import { trackNonModalTabOrder } from "../../dom/non-modal-tab-order"
import { overlayEffect } from "../../dom/overlay"
import { type PlacementState, placementFrom, unplaced } from "../../dom/position/connect"
import { positioningPresets, resolvePositioning } from "../../dom/position/options"
import type { IndicatorBox, IndicatorCause, MeasuredIndicator } from "../../dom/selection-indicator"
import { nextIndicator } from "../../dom/selection-indicator"
import type { BaseDomEnvironment } from "../../env/base-environment"
import type { ClockEnv } from "../../env/capabilities"
import type { HoverIntentEnv } from "../../env/hover-intent"
import type {
  Align,
  PositionEnv,
  PositioningOptions,
  PositioningProps,
  Side,
} from "../../env/position"
import { itemId, partId } from "../../ids"
import { session } from "../../machine/session"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import type { NavigationMenuLevel } from "./navigation-menu-tree"

/** Why the open item changed (`onValueChange`'s `details.reason`). */
export type NavigationMenuReason =
  | "trigger-press"
  | "trigger-hover"
  | "trigger-key"
  | "pointer-leave"
  | "escape-key"
  | "outside-press"
  | "outside-focus"
  | "link-activate"
  | "parent-close"
  | "api"

export type NavigationMenuFocusMove = "next" | "prev" | "first" | "last" | "into"

export type NavigationMenuEvent =
  /** A trigger's hover intent (mouse or pen), or the pointer back in the open item's zone. */
  | { readonly type: "HOVER.START"; readonly item: string }
  /** The pointer left a trigger (`item`) or the open item's hover zone (`null`). */
  | { readonly type: "HOVER.END"; readonly item: string | null }
  | { readonly type: "PRESS"; readonly item: string; readonly modality: Modality }
  | { readonly type: "ESCAPE" }
  | { readonly type: "DISMISS"; readonly reason: "outside-press" | "outside-focus" }
  /** A same-tab activation of a link anywhere in the tree. */
  | { readonly type: "LINK.ACTIVATE" }
  /** The parent level closed. */
  | { readonly type: "PARENT.CLOSE" }
  | { readonly type: "OPEN"; readonly item: string }
  | { readonly type: "CLOSE" }
  /** An arrow, Home or End key on a trigger or link (`from`: its element id). */
  | { readonly type: "FOCUS.MOVE"; readonly from: string; readonly to: NavigationMenuFocusMove }
  /** The `value` prop changed (a controlled menu). */
  | { readonly type: "VALUE.SYNC" }
  /** The `disabled` prop or an item's disabled state changed. */
  | { readonly type: "DISABLED" }
  | {
      readonly type: "INDICATOR.MEASURE"
      readonly box: IndicatorBox | null
      readonly cause: IndicatorCause
    }
  | {
      readonly type: "POSITION.PLACED"
      readonly side: Side
      readonly align: Align
      readonly anchorHidden: boolean
      readonly first: boolean
    }

export type NavigationMenuChangeDetails = Omit<ChangeDetails<NavigationMenuEvent>, "reason"> & {
  readonly reason: NavigationMenuReason
}

export interface NavigationMenuProps {
  /** The open item's key (controlled); `null` when none is open. */
  readonly value?: string | null | undefined
  /** The item open at first (uncontrolled). */
  readonly defaultValue?: string | null | undefined
  /** Called when the open item changes, with `details.reason`. */
  readonly onValueChange?:
    | ((value: string | null, details: NavigationMenuChangeDetails) => void)
    | undefined
  /** Open items when a mouse or pen rests on their trigger (default true). */
  readonly openOnHover?: boolean | undefined
  /** Disables every trigger. */
  readonly disabled?: boolean | undefined
  /** Hover time before an item opens (default 200 ms). */
  readonly openDelay?: number | undefined
  /** Time before a hover-opened item closes once the pointer left (default 300 ms). */
  readonly closeDelay?: number | undefined
  /** After a close, how long hovering a trigger opens it with no delay (default 300 ms). */
  readonly skipDelay?: number | undefined
  /** A press this soon after a hover open keeps the item open (default 500 ms). */
  readonly patientClick?: number | undefined
  /** Which arrows move along the bar and which one enters an open panel. */
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** The level's instance id (part ids derive from it). */
  readonly root: string
  /** The layer the level is in (a Sub's: its parent panel's). */
  readonly parent?: LayerId | undefined
  /** The level's place in the tree (link activation closes the tree). */
  readonly level?: NavigationMenuLevel | undefined
  /** An item's trigger is disabled. */
  readonly isItemDisabled?: ((item: string) => boolean) | undefined
  /**
   * A Positioner is rendered: around the level's Viewport (`level`), or one per item around
   * its Content (`item`).
   */
  readonly positioned?: "level" | "item" | undefined
  /** The Positioner's anchor (default the open trigger). */
  readonly anchor?: "trigger" | "list" | undefined
  /** Side, alignment and offsets, over the defaults (below, start, 4 px). */
  readonly positioning?: PositioningProps | undefined
}

export interface NavigationMenuContext {
  /** The item waiting for the open delay. */
  readonly pending: string | null
  /** How the open item opened: only a hover-opened item closes when the pointer leaves. */
  readonly openedBy: "hover" | "press" | "keyboard" | "api"
  /** Clock time of the last open (the patient-click window). */
  readonly openedAt: number
  /** Closed by Escape or a press: hover does not reopen it until the pointer leaves it. */
  readonly suppressHover: string | null
  /** The item open before the last switch (`data-motion`), null after an open from closed. */
  readonly previous: string | null
  /** The last open skipped the open delay (a switch or a warm open). */
  readonly instant: boolean
  /** Why the level last closed. */
  readonly closeReason: NavigationMenuReason | null
  /** The positioned panel's side and alignment. */
  readonly placement: PlacementState
  /** The open trigger's box, for the Indicator. */
  readonly indicator: MeasuredIndicator | null
}

export const navigationMenuIds = (root: string) => ({
  root: partId("navigation-menu", root, "root"),
  list: partId("navigation-menu", root, "list"),
  viewport: partId("navigation-menu", root, "viewport"),
  positioner: partId("navigation-menu", root, "positioner"),
  /** A Positioner around one item's Content (no Viewport). */
  itemPositioner: (key: string) => itemId("navigation-menu", root, "positioner", key),
  trigger: (key: string) => itemId("navigation-menu", root, "trigger", key),
  content: (key: string) => itemId("navigation-menu", root, "content", key),
})

export const navigationMenuLayerId = (root: string) => layerId(`navigation-menu-${root}`)

/** Below the trigger (beside it when vertical), aligned to its start, 4 px away. */
export const navigationMenuPositioning = (
  props: Pick<NavigationMenuProps, "positioning" | "orientation">,
): PositioningOptions =>
  resolvePositioning(props.positioning, {
    ...positioningPresets.popup,
    side: props.orientation === "vertical" ? "inline-end" : "bottom",
    align: "start",
    sideOffset: 4,
    collisionPadding: 8,
  })

const initialPlacement = (props: NavigationMenuProps) => {
  const o = navigationMenuPositioning(props)
  const side = o.side === "inline-start" ? "left" : o.side === "inline-end" ? "right" : o.side
  return unplaced(side, o.align)
}

type Env = BaseDomEnvironment & PositionEnv & HoverIntentEnv & ClockEnv

/** The value the runtime falls back to: nothing open. */
const NONE = null as unknown as string

const docOf = (env: Env) => {
  const node = env.dom.getRootNode()
  return "body" in node ? node : node.ownerDocument
}

/** The pointer is in some layer's grace area (no document, as on the server: never). */
const inTransit = (env: Env) => {
  if (typeof document === "undefined") return false
  const node = env.dom.getRootNode() as Document | ShadowRoot | undefined
  if (!node) return false
  return env.hoverIntent.isInTransit("body" in node ? node : node.ownerDocument)
}

/**
 * The layer as hover zones and the Tab order see it: its panels and descendant layers
 * rendered outside the root, not the whole root (the layer holds the root so presses on
 * the bar are inside; the bar's other items are not part of an item's zone).
 */
function panelLayer(
  layer: LayerHandle,
  panels: () => readonly HTMLElement[],
  root: () => HTMLElement | null,
): LayerHandle {
  return {
    ...layer,
    id: layer.id,
    parentId: layer.parentId,
    contains: (target: EventTarget | null) =>
      target instanceof Node &&
      (panels().some((p) => p.contains(target)) ||
        (layer.contains(target) && root()?.contains(target) !== true)),
  }
}

const ITEM = '[data-scope="navigation-menu"]:is([data-part="trigger"], [data-part="link"])'
const BOX = '[data-scope="navigation-menu"]:is([data-part="content"], [data-part="root"])'

/** The triggers and links that arrow keys move between with `el`: same panel, or the bar. */
function navigationSet(el: HTMLElement): HTMLElement[] {
  const box = el.parentElement?.closest(BOX)
  if (!box) return [el]
  return [...box.querySelectorAll<HTMLElement>(ITEM)].filter(
    (x) =>
      x.parentElement?.closest(BOX) === box &&
      x.closest("[hidden]") === null &&
      !x.matches(":disabled"),
  )
}

const enabled = (props: NavigationMenuProps, item: string) =>
  props.disabled !== true && props.isItemDisabled?.(item) !== true

type AnyEvent = NavigationMenuEvent | { readonly type: `after:${string}` | `$${string}` }

const itemOf = (e: AnyEvent) =>
  e.type === "HOVER.START" || e.type === "PRESS" || e.type === "OPEN" ? e.item : null

const pressReason = (e: AnyEvent): NavigationMenuReason =>
  e.type === "PRESS" && e.modality === "keyboard" ? "trigger-key" : "trigger-press"

export const navigationMenuMachine = /* @__PURE__ */ setup({
  types: type<{
    props: NavigationMenuProps
    events: NavigationMenuEvent
    env: Env
    context: NavigationMenuContext
    values: "value"
  }>(),
  guards: {
    hoverable: ({ event, props, context, env }) =>
      event.type === "HOVER.START" &&
      props.openOnHover !== false &&
      enabled(props, event.item) &&
      context.suppressHover !== event.item &&
      !inTransit(env),
    canOpen: ({ event, props }) => {
      const item = itemOf(event)
      return item !== null && enabled(props, item)
    },
    isOpenItem: ({ event, values }) => itemOf(event) === values.value,
    isPending: ({ event, context }) => itemOf(event) === context.pending,
    leftPending: ({ event, context }) =>
      event.type === "HOVER.END" && event.item !== null && event.item === context.pending,
    patient: ({ context, props, env }) =>
      context.openedBy === "hover" &&
      env.clock.now() - context.openedAt < (props.patientClick ?? 500),
    zoneLeft: ({ event, context }) =>
      event.type === "HOVER.END" && event.item === null && context.openedBy === "hover",
    /** Focus is in the open content or the viewport: a hover close waits for it to leave. */
    focusInside: ({ env, props, values }) => {
      if (values.value === null || typeof document === "undefined") return false
      const active = env.dom.activeElement()
      const ids = navigationMenuIds(props.root)
      const boxes = [env.dom.getById(ids.content(values.value)), env.dom.getById(ids.viewport)]
      return active !== null && boxes.some((b) => b?.contains(active) === true)
    },
    syncedOpen: ({ values }) => values.value !== null && values.value !== undefined,
    openDisabled: ({ props, values }) =>
      values.value !== null && values.value !== undefined && !enabled(props, values.value),
  },
  actions: {
    setPending: ({ event, set }) => set("pending", itemOf(event)),
    clearPending: ({ set }) => set("pending", null),
    /** Opens from a closed state: the event's item, or the pending one after the delay. */
    open: ({ event, context, env, props, set }) => {
      const item = itemOf(event) ?? context.pending
      if (item === null) return
      set(
        "openedBy",
        event.type === "PRESS"
          ? event.modality === "keyboard"
            ? "keyboard"
            : "press"
          : event.type === "OPEN"
            ? "api"
            : "hover",
      )
      set("openedAt", env.clock.now())
      set("pending", null)
      set("previous", null)
      set("closeReason", null)
      set("placement", initialPlacement(props))
      set("value", item)
      // A suppression from an earlier keyboard close must not outlive the next open: the
      // pointer may never have been on that trigger to leave it (radix#1529 is about one that was).
      set("suppressHover", null)
    },
    warmOpen: ({ set }) => set("instant", true),
    delayedOpen: ({ set }) => set("instant", false),
    /** From the open item to the event's, in one step. */
    switchTo: ({ event, env, props, values, set }) => {
      const item = itemOf(event)
      if (item === null || item === values.value) return
      props.level?.closeChildren()
      set("previous", values.value)
      set(
        "openedBy",
        event.type === "HOVER.START" ? "hover" : event.type === "OPEN" ? "api" : "press",
      )
      set("openedAt", env.clock.now())
      set("instant", true)
      set("value", item)
      set("suppressHover", null)
    },
    keepByPress: ({ set }) => set("openedBy", "press"),
    /** The open panel closed or changed: its nested levels close (even while opening). */
    closeChildren: ({ props }) => props.level?.closeChildren(),
    /** A default or controlled value at start opens that item. */
    startOpen: ({ event, values, send }) => {
      if (event.type === "$start" && values.value !== null && values.value !== undefined)
        send({ type: "VALUE.SYNC" })
    },
    /**
     * Hover stays off the item just closed while the pointer is still on it (radix#1529). A
     * panel the keyboard or the API opened says nothing about the pointer: no suppression,
     * or a mouse arriving later would find the trigger dead until it left and came back.
     */
    suppress: ({ context, values, set }) => {
      if (context.openedBy === "keyboard" || context.openedBy === "api") return
      set("suppressHover", values.value)
    },
    clearSuppress: ({ event, context, set }) => {
      if (event.type === "HOVER.END" && event.item !== null && event.item === context.suppressHover)
        set("suppressHover", null)
    },
    close: ({ set }) => {
      set("previous", null)
      set("value", NONE)
    },
    syncOpen: ({ set }) => {
      set("openedBy", "api")
      set("previous", null)
    },
    /** Arrow keys between the menu's own triggers and links (DOM order). */
    moveFocus: ({ event, env, props, values }) => {
      if (event.type !== "FOCUS.MOVE") return
      const from = env.dom.getById(event.from)
      if (!from) return
      let target: HTMLElement | undefined
      if (event.to === "into") {
        if (values.value === null || from.getAttribute("aria-expanded") !== "true") return
        const ids = navigationMenuIds(props.root)
        const content = env.dom.getById(ids.content(values.value))
        const first = content?.querySelector<HTMLElement>(ITEM)
        target = first ? navigationSet(first)[0] : undefined
      } else {
        const set = navigationSet(from)
        const at = set.indexOf(from)
        target =
          event.to === "first"
            ? set[0]
            : event.to === "last"
              ? set.at(-1)
              : event.to === "next"
                ? set[at + 1]
                : at > 0
                  ? set[at - 1]
                  : undefined
      }
      if (target) void focusSafely(target, env, "navigation")
    },
    measureIndicator: ({ event, context, set }) => {
      if (event.type !== "INDICATOR.MEASURE") return
      const next = nextIndicator(context.indicator, event.box, event.cause)
      if (next !== undefined) set("indicator", next)
    },
    setPlacement: ({ event, set }) => {
      if (event.type === "POSITION.PLACED") set("placement", placementFrom(event))
    },
    setCloseReason: ({ event, set }) => {
      const reason: NavigationMenuReason | null =
        event.type === "ESCAPE"
          ? "escape-key"
          : event.type === "DISMISS"
            ? event.reason
            : event.type === "LINK.ACTIVATE"
              ? "link-activate"
              : event.type === "PARENT.CLOSE"
                ? "parent-close"
                : event.type === "PRESS"
                  ? pressReason(event)
                  : event.type === "after:closeDelay"
                    ? "pointer-leave"
                    : "api"
      set("closeReason", reason)
    },
  },
  delays: {
    openDelay: ({ props }) => props.openDelay ?? 200,
    closeDelay: ({ props }) => props.closeDelay ?? 300,
    skipDelay: ({ props }) => props.skipDelay ?? 300,
  },
  effects: {
    /** Open or closing: the layer, the hover zone and the positioning, kept across both. */
    shown: (a) => {
      const { env } = a
      if (typeof document === "undefined") return undefined
      const root = a.props.root
      const ids = navigationMenuIds(root)
      return session<typeof a, NavigationMenuEvent>(
        `navigation-menu:${root}`,
        a,
        (s) => {
          const send = (e: NavigationMenuEvent) => s.owner.send(e)
          const props = () => s.owner.props
          const open = () => s.owner.values.value
          const byId = (id: string) => env.dom.getById(id)
          // The last open item's trigger: still the opener while the layer closes down.
          let last: string | null = null
          const key = () => {
            last = open() ?? last
            return last
          }
          const trigger = () => {
            const k = key()
            return k === null ? null : byId(ids.trigger(k))
          }
          const content = () => {
            const k = key()
            return k === null ? null : byId(ids.content(k))
          }
          const panels = () => {
            const k = key()
            return [
              content(),
              byId(ids.viewport),
              byId(ids.positioner),
              k === null ? null : byId(ids.itemPositioner(k)),
            ].filter((e): e is HTMLElement => e !== null)
          }
          const id = navigationMenuLayerId(root)
          const doc = docOf(env)
          const rootEl = () => byId(ids.root)
          const DISMISSAL: Record<DismissReason, NavigationMenuEvent> = {
            "escape-key": { type: "ESCAPE" },
            "outside-press": { type: "DISMISS", reason: "outside-press" },
            "outside-focus": { type: "DISMISS", reason: "outside-focus" },
            "parent-dismissed": { type: "PARENT.CLOSE" },
          }
          const stopLayer = overlayEffect(env, {
            id,
            kind: "popover",
            family: "navigation-menu",
            modal: false,
            parent: props().parent,
            opener: trigger,
            // The whole level is inside: a press on another trigger switches, and a press on a
            // bar link is that link's activation (or an "open elsewhere" that keeps it open).
            elements: () => [rootEl(), ...panels()].filter((e): e is HTMLElement => e !== null),
            container: () => content() ?? byId(ids.viewport),
            // Disclosure navigation: opening never moves focus.
            initialFocus: () => false,
            // To the trigger, only when focus was inside the closing panel or fell to <body>:
            // focus that moved elsewhere (outside focus, a press on a field) stays there.
            // Escape, or a link activated inside the panel (the panel hides around it): to the
            // trigger. Hover, outside press and outside focus closes never move focus.
            finalFocus: (reason) =>
              reason === "escape-key" || s.owner.context.closeReason === "link-activate"
                ? trigger()
                : false,
            modality: env.modality.modality(),
            dismiss: {
              escape: true,
              outsidePress: true,
              outsideFocus: true,
              onRequest: (request) => {
                // Outside focus closes only when focus leaves the menu (a top-level link is
                // inside), and only from inside it: focus arriving from outside (another
                // layer's initial focus) is not leaving.
                if (request.reason === "outside-focus") {
                  const inMenu = (n: unknown) =>
                    n instanceof Node &&
                    (rootEl()?.contains(n) === true || panels().some((p) => p.contains(n)))
                  const from = (request.event as FocusEvent | undefined)?.relatedTarget
                  if (inMenu(request.target) || !inMenu(from)) return request.cancel()
                }
                send(DISMISSAL[request.reason])
              },
            },
          })
          const layer = getLayerStack(doc).get(id)
          const stopHover = layer
            ? env.hoverIntent.track({
                trigger,
                elements: panels,
                layer: panelLayer(layer, panels, rootEl),
                onLeave: () => send({ type: "HOVER.END", item: null }),
                onEnter: () => {
                  const v = open()
                  if (v !== null) send({ type: "HOVER.START", item: v })
                },
              })
            : () => {}
          const track =
            props().positioned === "level"
              ? env.position.track({
                  anchor: {
                    kind: "virtual",
                    get: () => {
                      const el = props().anchor === "list" ? byId(ids.list) : trigger()
                      return el
                        ? {
                            getBoundingClientRect: () => el.getBoundingClientRect(),
                            contextElement: el,
                          }
                        : null
                    },
                  },
                  positioner: ids.positioner,
                  options: () => navigationMenuPositioning(props()),
                  onPlacement: (p, first) => {
                    s.placed = { type: "POSITION.PLACED", ...p, first: true }
                    send({ type: "POSITION.PLACED", ...p, first })
                  },
                })
              : null
          return () => {
            track?.stop()
            stopHover()
            stopLayer()
          }
        },
        (s) => {
          if (s.placed) s.owner.send(s.placed)
        },
      )
    },
    /** The open item's content follows its trigger in the Tab order; restarted per switch. */
    follow: ({ env, props, values, send }) => {
      if (typeof document === "undefined" || values.value === null) return undefined
      const ids = navigationMenuIds(props.root)
      const key = values.value
      const layer = getLayerStack(docOf(env)).get(navigationMenuLayerId(props.root))
      if (props.positioned === "level") env.position.reposition(ids.positioner)
      // One Positioner per item: the open item's, against its own trigger.
      const track =
        props.positioned === "item"
          ? env.position.track({
              anchor: { kind: "element", id: ids.trigger(key) },
              positioner: ids.itemPositioner(key),
              options: () => navigationMenuPositioning(props),
              onPlacement: (p, first) => send({ type: "POSITION.PLACED", ...p, first }),
            })
          : null
      if (!layer) return () => track?.stop()
      // Leaving the panel forward continues after the trigger, past the other bar items:
      // only the panels count as this layer for the Tab order (the layer holds the root).
      const panels = () =>
        [
          env.dom.getById(ids.content(key)),
          env.dom.getById(ids.viewport),
          env.dom.getById(ids.positioner),
          env.dom.getById(ids.itemPositioner(key)),
        ].filter((e): e is HTMLElement => e !== null)
      const stopTab = trackNonModalTabOrder(env, {
        trigger: () => env.dom.getById(ids.trigger(key)),
        content: () => env.dom.getById(ids.content(key)),
        layer: panelLayer(layer, panels, () => env.dom.getById(ids.root)),
      })
      return () => {
        track?.stop()
        stopTab()
      }
    },
  },
}).machine({
  id: "navigation-menu",
  initial: "closed",
  context: (props) => ({
    pending: null,
    openedBy: "api",
    openedAt: 0,
    suppressHover: null,
    previous: null,
    instant: false,
    closeReason: null,
    placement: initialPlacement(props),
    indicator: null,
  }),
  values: { value: { fallback: NONE } },
  onProps: { value: "VALUE.SYNC", disabled: "DISABLED" },
  on: {
    "HOVER.END": { actions: ["clearSuppress"] },
    "FOCUS.MOVE": { actions: ["moveFocus"] },
    "INDICATOR.MEASURE": { actions: ["measureIndicator"] },
    "POSITION.PLACED": { actions: ["setPlacement"] },
    // A parent's value, or a refused proposal: the state follows the value.
    "VALUE.SYNC": [
      { guard: "syncedOpen", target: "open", actions: ["syncOpen"] },
      { target: "closed" },
    ],
    $reverted: [
      { guard: "syncedOpen", target: "open", actions: ["syncOpen"] },
      { target: "closed" },
    ],
  },
  states: {
    closed: {
      // A default or controlled value at start: open.
      entry: ["startOpen", "closeChildren"],
      on: {
        "HOVER.START": { guard: "hoverable", target: "opening", actions: ["setPending"] },
        PRESS: {
          guard: "canOpen",
          target: "open",
          reason: pressReason,
          actions: ["delayedOpen", "open"],
        },
        OPEN: { guard: "canOpen", target: "open", reason: "api", actions: ["delayedOpen", "open"] },
      },
    },
    warm: {
      entry: ["closeChildren"],
      after: { skipDelay: "closed" },
      on: {
        "PARENT.CLOSE": "closed",
        "HOVER.START": {
          guard: "hoverable",
          target: "open",
          reason: "trigger-hover",
          actions: ["warmOpen", "open"],
        },
        PRESS: {
          guard: "canOpen",
          target: "open",
          reason: pressReason,
          actions: ["delayedOpen", "open"],
        },
        OPEN: { guard: "canOpen", target: "open", reason: "api", actions: ["delayedOpen", "open"] },
      },
    },
    opening: {
      after: {
        openDelay: { target: "open", reason: "trigger-hover", actions: ["delayedOpen", "open"] },
      },
      on: {
        "HOVER.START": [
          { guard: "isPending" },
          { guard: "hoverable", target: "opening", reenter: true, actions: ["setPending"] },
        ],
        "HOVER.END": {
          guard: "leftPending",
          target: "closed",
          actions: ["clearPending", "clearSuppress"],
        },
        PRESS: {
          guard: "canOpen",
          target: "open",
          reason: pressReason,
          actions: ["delayedOpen", "open"],
        },
        OPEN: { guard: "canOpen", target: "open", reason: "api", actions: ["delayedOpen", "open"] },
        CLOSE: { target: "closed", actions: ["clearPending"] },
        DISABLED: { target: "closed", actions: ["clearPending"] },
        // The parent panel closed: a nested level never opens hidden.
        "PARENT.CLOSE": { target: "closed", actions: ["clearPending"] },
      },
    },
    open: {
      effects: ["shown", "follow"],
      on: {
        "HOVER.START": [
          { guard: "isOpenItem" },
          {
            guard: "hoverable",
            target: "open",
            reenter: true,
            reason: "trigger-hover",
            actions: ["switchTo"],
          },
        ],
        "HOVER.END": [
          { guard: { and: ["zoneLeft", { not: "focusInside" }] }, target: "closing" },
          { actions: ["clearSuppress"] },
        ],
        PRESS: [
          { guard: { and: ["isOpenItem", "patient"] }, actions: ["keepByPress"] },
          {
            guard: "isOpenItem",
            target: "warm",
            reason: pressReason,
            actions: ["setCloseReason", "suppress", "close"],
          },
          {
            guard: "canOpen",
            target: "open",
            reenter: true,
            reason: pressReason,
            actions: ["switchTo"],
          },
        ],
        OPEN: [
          { guard: "isOpenItem" },
          { guard: "canOpen", target: "open", reenter: true, reason: "api", actions: ["switchTo"] },
        ],
        ESCAPE: {
          target: "warm",
          reason: "escape-key",
          actions: ["setCloseReason", "suppress", "close"],
        },
        DISMISS: {
          target: "warm",
          reason: (e: NavigationMenuEvent) => (e.type === "DISMISS" ? e.reason : "api"),
          actions: ["setCloseReason", "close"],
        },
        "LINK.ACTIVATE": {
          target: "warm",
          reason: "link-activate",
          actions: ["setCloseReason", "close"],
        },
        "PARENT.CLOSE": {
          target: "closed",
          reason: "parent-close",
          actions: ["setCloseReason", "close"],
        },
        CLOSE: { target: "warm", reason: "api", actions: ["setCloseReason", "close"] },
        DISABLED: {
          guard: "openDisabled",
          target: "warm",
          reason: "api",
          actions: ["setCloseReason", "close"],
        },
      },
    },
    closing: {
      effects: ["shown", "follow"],
      after: {
        closeDelay: [
          { guard: "focusInside", target: "open" },
          { target: "warm", reason: "pointer-leave", actions: ["setCloseReason", "close"] },
        ],
      },
      on: {
        "HOVER.START": [
          { guard: "isOpenItem", target: "open" },
          { guard: "hoverable", target: "open", reason: "trigger-hover", actions: ["switchTo"] },
        ],
        PRESS: [
          {
            guard: "isOpenItem",
            target: "warm",
            reason: pressReason,
            actions: ["setCloseReason", "suppress", "close"],
          },
          { guard: "canOpen", target: "open", reason: pressReason, actions: ["switchTo"] },
        ],
        OPEN: [
          { guard: "isOpenItem", target: "open", actions: ["syncOpen"] },
          { guard: "canOpen", target: "open", reason: "api", actions: ["switchTo"] },
        ],
        ESCAPE: {
          target: "warm",
          reason: "escape-key",
          actions: ["setCloseReason", "suppress", "close"],
        },
        DISMISS: {
          target: "warm",
          reason: (e: NavigationMenuEvent) => (e.type === "DISMISS" ? e.reason : "api"),
          actions: ["setCloseReason", "close"],
        },
        "LINK.ACTIVATE": {
          target: "warm",
          reason: "link-activate",
          actions: ["setCloseReason", "close"],
        },
        "PARENT.CLOSE": {
          target: "closed",
          reason: "parent-close",
          actions: ["setCloseReason", "close"],
        },
        CLOSE: { target: "warm", reason: "api", actions: ["setCloseReason", "close"] },
        DISABLED: {
          guard: "openDisabled",
          target: "warm",
          reason: "api",
          actions: ["setCloseReason", "close"],
        },
      },
    },
  },
})

export type NavigationMenuMachine = typeof navigationMenuMachine
