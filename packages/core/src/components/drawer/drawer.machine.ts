// Drawer (design §1): the Dialog's machine pieces plus the gesture as events. Swiping is
// context, not a state: a `swiping` state would leave `open`, whose overlay effect would
// release the layer and restore focus. The dismiss and settle decisions are the pure
// functions of snap-points.ts, so the model oracle evaluates them as the page does.

import type { Modality } from "../../contract/env"
import { physicalSide } from "../../dom/position/options"
import { type SwipeDirection, type SwipeRelease, trackSwipe } from "../../dom/swipe"
import type { DomEnvironment } from "../../env/dom-environment"
import { partId } from "../../ids"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"
import {
  type DialogContext,
  type DialogEvent,
  type DialogProps,
  dialogPieces,
  layerIdOf,
} from "../dialog/dialog.machine"
import { drawerStack } from "./drawer-stack"
import {
  cycle,
  type ResolvedSnapPoint,
  resolveSnapPoints,
  type SnapPoint,
  type SnapSizes,
  settleTarget,
  swipeDismisses,
} from "./snap-points"

declare const process: { env: { NODE_ENV?: string } }

export type DrawerSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"
export type PhysicalSide = "top" | "bottom" | "left" | "right"

export type DrawerEvent =
  | DialogEvent
  | { readonly type: "SWIPE.START"; readonly modality: "pointer" | "touch" }
  | ({ readonly type: "SWIPE" } & SwipeRelease)
  | { readonly type: "SWIPE.CANCEL" }
  | { readonly type: "HANDLE_PRESS"; readonly modality: Modality }
  /** `api.setSnapPoint()`. */
  | { readonly type: "SNAP_POINT.SET"; readonly value: SnapPoint }
  | {
      readonly type: "SIZE.CHANGE"
      readonly content: number
      readonly viewport: number
      readonly rootFontSize: number
    }
  | {
      readonly type: "NESTED.CHANGE"
      readonly count: number
      readonly frontmostSize: number
      readonly swiping: boolean
    }

export interface DrawerProps extends DialogProps {
  /** Default "bottom". Logical sides resolve from `dir`. */
  readonly side?: DrawerSide | undefined
  /** The component's direction (the adapter's locale). */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Fraction of the content's size a release must reach to dismiss (default 0.5). */
  readonly swipeThreshold?: number | undefined
  /** px/ms toward the edge that dismisses (default 0.5). */
  readonly swipeVelocityThreshold?: number | undefined
  /** Default true; false keeps the gesture for snap points only. */
  readonly closeOnSwipe?: boolean | undefined
  readonly snapPoints?: readonly SnapPoint[] | undefined
  readonly snapPoint?: SnapPoint | undefined
  readonly defaultSnapPoint?: SnapPoint | undefined
  readonly onSnapPointChange?:
    | ((value: SnapPoint, details: ChangeDetails<DrawerEvent>) => void)
    | undefined
  readonly snapToSequentialPoints?: boolean | undefined
}

export interface DrawerContext extends DialogContext {
  readonly swipe: "idle" | "swiping" | "releasing"
  readonly sizes: SnapSizes
  readonly nested: {
    readonly count: number
    readonly frontmostSize: number
    readonly swiping: boolean
  }
}

/** The drawer's physical side: logical sides resolve from `dir`. */
export const drawerSide = (props: Pick<DrawerProps, "side" | "dir">): PhysicalSide =>
  physicalSide(props.side ?? "bottom", props.dir ?? "ltr")

/** The swipe direction that dismisses: toward the side's edge. */
export const EDGE: Record<PhysicalSide, SwipeDirection> = {
  top: "up",
  bottom: "down",
  left: "left",
  right: "right",
}
/** The axis directions a drawer follows (toward its edge and back, for snap points). */
const AXIS: Record<PhysicalSide, readonly SwipeDirection[]> = {
  top: ["up", "down"],
  bottom: ["up", "down"],
  left: ["left", "right"],
  right: ["left", "right"],
}

const settings = (props: DrawerProps) => ({
  edge: EDGE[drawerSide(props)],
  closeOnSwipe: props.closeOnSwipe !== false,
  swipeThreshold: props.swipeThreshold ?? 0.5,
  swipeVelocityThreshold: props.swipeVelocityThreshold ?? 0.5,
})

/** The resolved snap points for the current sizes (empty without snap points). */
export const resolvedPoints = (
  props: Pick<DrawerProps, "snapPoints">,
  sizes: SnapSizes,
): ResolvedSnapPoint[] =>
  props.snapPoints && props.snapPoints.length > 0 && sizes.content > 0
    ? resolveSnapPoints(props.snapPoints, sizes)
    : []

/**
 * Runs `start` once `el()` exists: a portalled content mounts after the state's effects
 * start. Frames, bounded; returns the cleanup of whichever ran.
 */
function whenMounted(
  env: DomEnvironment,
  el: () => HTMLElement | null,
  start: (el: HTMLElement) => () => void,
): () => void {
  let stop: (() => void) | null = null
  let frame: ReturnType<DomEnvironment["scheduler"]["requestAnimationFrame"]> | null = null
  const attempt = (left: number) => {
    frame = null
    const node = el()
    if (node) stop = start(node)
    else if (left > 0) frame = env.scheduler.requestAnimationFrame(() => attempt(left - 1))
  }
  attempt(60)
  return () => {
    if (frame !== null) env.scheduler.cancelAnimationFrame(frame)
    stop?.()
  }
}

/** The runtime's fallback for "no snap point" (a controllable needs a value of its type). */
const NO_POINT = null as unknown as SnapPoint

const pieces = dialogPieces({ scope: "drawer", kind: "drawer", family: "drawer" })
type DialogArgs = Parameters<typeof pieces.actions.enterOpen>[0]
// Sound: the drawer's arguments are the dialog's with a wider event union and context; the
// dialog pieces read only the dialog's fields.
const asDialog = (a: unknown) => a as DialogArgs
type DialogEffectArgs = Parameters<typeof pieces.effects.overlay>[0]

export const drawerMachine = setup({
  types: type<{
    props: DrawerProps
    events: DrawerEvent
    env: DomEnvironment
    context: DrawerContext
    values: "open" | "snapPoint"
  }>(),
  guards: {
    isNonModal: (a) => pieces.guards.isNonModal(asDialog(a)),
    closesOnEscape: (a) => pieces.guards.closesOnEscape(asDialog(a)),
    closesOnOutsidePress: (a) => pieces.guards.closesOnOutsidePress(asDialog(a)),
    swipeDismisses: ({ context, event, props, values }) => {
      if (event.type !== "SWIPE") return false
      const resolved = resolvedPoints(props, context.sizes)
      const current = values.snapPoint
      return swipeDismisses(
        event,
        settings(props),
        resolved.length > 0 && current !== null ? { resolved, current } : undefined,
      )
    },
    hasSnapPoints: ({ context, props }) => resolvedPoints(props, context.sizes).length >= 2,
  },
  actions: {
    enterOpen: (a) => pieces.actions.enterOpen(asDialog(a)),
    setCloseReason: (a) => pieces.actions.setCloseReason(asDialog(a)),
    /** Each open starts at the default point (uncontrolled; the exit keeps its point). */
    resetSnapPoint: ({ props, set }) => {
      const first = props.defaultSnapPoint ?? props.snapPoints?.[0]
      if (first !== undefined) set("snapPoint", first)
      set("swipe", "idle")
    },
    startSwipe: ({ set }) => set("swipe", "swiping"),
    /** A dismissing release: the content keeps its release position until it closes. */
    releaseToClose: ({ set }) => set("swipe", "releasing"),
    endSwipe: ({ set }) => set("swipe", "idle"),
    settleSnapPoint: ({ context, event, props, set, values }) => {
      if (event.type !== "SWIPE") return
      const resolved = resolvedPoints(props, context.sizes)
      if (resolved.length === 0 || values.snapPoint === null) return
      const s = settings(props)
      const target = settleTarget(
        event,
        {
          edge: s.edge,
          sequential: props.snapToSequentialPoints === true,
          swipeVelocityThreshold: s.swipeVelocityThreshold,
        },
        { resolved, current: values.snapPoint },
      )
      if (target && target.point !== values.snapPoint) set("snapPoint", target.point)
    },
    cycleSnapPoint: ({ context, props, set, values }) => {
      const next = cycle(resolvedPoints(props, context.sizes), values.snapPoint)
      if (next) set("snapPoint", next.point)
    },
    setSnapPoint: ({ event, set }) => {
      if (event.type === "SNAP_POINT.SET") set("snapPoint", event.value)
    },
    setSizes: ({ event, set }) => {
      if (event.type !== "SIZE.CHANGE") return
      set("sizes", {
        content: event.content,
        viewport: event.viewport,
        rootFontSize: event.rootFontSize,
      })
    },
    setNested: ({ event, set }) => {
      if (event.type !== "NESTED.CHANGE") return
      set("nested", {
        count: event.count,
        frontmostSize: event.frontmostSize,
        swiping: event.swiping,
      })
    },
  },
  effects: {
    overlay: (a) => pieces.effects.overlay(a as unknown as DialogEffectArgs),
    nameCheck: (a) => pieces.effects.nameCheck(a as unknown as DialogEffectArgs),
    /** The gesture on the content: discrete events only; movement stays in CSS variables. */
    swipeTracking: (a) => {
      const { env, props, send } = a
      if (typeof document === "undefined") return undefined
      const content = () => env.dom.getById(partId("drawer", props.root, "content"))
      const handle = () => env.dom.getById(partId("drawer", props.root, "handle"))
      const side = drawerSide(props)
      return whenMounted(env, content, (node) => {
        const tracker = trackSwipe(env, {
          element: () => node,
          directions: () => AXIS[side],
          prefix: "drawer",
          alwaysFrom: () => [handle()].filter((e): e is HTMLElement => e !== null),
          onStart: (e) => send({ type: "SWIPE.START", modality: e.modality }),
          onEnd: (e) => {
            send({ type: "SWIPE", ...e })
            // An uncontrolled `cancel()` ran no actions: the gesture settles here.
            // (Effects read live context and values.)
            if (a.values.open && a.context.swipe === "swiping") send({ type: "SWIPE.CANCEL" })
            if (a.context.swipe !== "releasing") tracker.reset()
          },
          onCancel: () => send({ type: "SWIPE.CANCEL" }),
          onProgress: (p) => drawerStack(env).progress(layerIdOf("drawer", props.root), p),
        })
        return () => tracker.stop()
      })
    },
    /** Border-box size on the axis, the viewport and the root font size. */
    measureSize: ({ env, props, send }) => {
      if (typeof document === "undefined") return undefined
      const content = () => env.dom.getById(partId("drawer", props.root, "content"))
      return whenMounted(env, content, (el) => {
        const win = el.ownerDocument.defaultView
        if (!win) return () => {}
        const vertical = (() => {
          const s = drawerSide(props)
          return s === "top" || s === "bottom"
        })()
        const measure = () => {
          const r = el.getBoundingClientRect()
          const root = win.getComputedStyle(el.ownerDocument.documentElement)
          send({
            type: "SIZE.CHANGE",
            content: vertical ? r.height : r.width,
            viewport: vertical ? win.innerHeight : win.innerWidth,
            rootFontSize: Number.parseFloat(root.fontSize) || 16,
          })
        }
        measure()
        const observer =
          typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure())
        observer?.observe(el, { box: "border-box" })
        win.addEventListener("resize", measure)
        return () => {
          observer?.disconnect()
          win.removeEventListener("resize", measure)
        }
      })
    },
    /** This drawer in the document's registry; nested drawers' metrics come back as events. */
    nestedMetrics: (a) => {
      const { env, props, send } = a
      if (typeof document === "undefined") return undefined
      const id = layerIdOf("drawer", props.root)
      const stack = drawerStack(env)
      const content = () => env.dom.getById(partId("drawer", props.root, "content"))
      // After the content mounts: its size is measured from there on.
      return whenMounted(env, content, () =>
        stack.register(id, {
          modal: props.modal !== false,
          size: () => {
            const el = content()
            if (!el) return 0
            const r = el.getBoundingClientRect()
            const s = drawerSide(props)
            return s === "top" || s === "bottom" ? r.height : r.width
          },
          swiping: () => a.context.swipe === "swiping",
          backdrop: () => env.dom.getById(partId("drawer", props.root, "backdrop")),
          onNested: (n) => send({ type: "NESTED.CHANGE", ...n }),
        }),
      )
    },
    /** The on-screen keyboard's height (top and bottom drawers), on the positioner. */
    keyboardInset: ({ env, props }) => {
      if (typeof document === "undefined") return undefined
      const side = drawerSide(props)
      if (side !== "top" && side !== "bottom") return undefined
      const positioner = () => env.dom.getById(partId("drawer", props.root, "positioner"))
      const win = positioner()?.ownerDocument.defaultView
      const vv = win?.visualViewport
      if (!win || !vv) return undefined
      const write = () => {
        const inset = Math.max(0, win.innerHeight - vv.height - vv.offsetTop)
        positioner()?.style.setProperty("--rind-drawer-keyboard-inset", `${Math.round(inset)}px`)
      }
      write()
      vv.addEventListener("resize", write)
      vv.addEventListener("scroll", write)
      return () => {
        vv.removeEventListener("resize", write)
        vv.removeEventListener("scroll", write)
        positioner()?.style.removeProperty("--rind-drawer-keyboard-inset")
      }
    },
    /** One development warning when the gesture is the only way out (touch screen readers). */
    onlyWayOut: ({ env, props }) => {
      if (process.env.NODE_ENV === "production" || typeof document === "undefined") return undefined
      const frame = env.scheduler.requestAnimationFrame(() => {
        const content = env.dom.getById(partId("drawer", props.root, "content"))
        if (!content) return
        const closeTrigger = content.querySelector(
          '[data-scope="drawer"][data-part="close-trigger"]',
        )
        const modal = props.modal !== false
        const outside = props.closeOnInteractOutside ?? modal
        if (!closeTrigger && !outside) {
          console.warn(
            `[rind-ui] drawer: #${content.id} has no close trigger and outside presses do not close it; a swipe is then the only way out, which touch screen-reader users cannot do`,
          )
        }
      })
      return () => env.scheduler.cancelAnimationFrame(frame)
    },
  },
}).machine({
  id: "drawer",
  initial: "closed",
  context: () => ({
    ...pieces.context(),
    swipe: "idle",
    sizes: { content: 0, viewport: 0, rootFontSize: 16 },
    nested: { count: 0, frontmostSize: 0, swiping: false },
  }),
  values: {
    open: { fallback: false, states: { open: true, closed: false } },
    snapPoint: { fallback: NO_POINT },
  },
  on: { $reverted: { actions: ["endSwipe"] } },
  states: {
    closed: { on: pieces.closedOn },
    open: {
      ...pieces.open,
      entry: [...pieces.open.entry, "resetSnapPoint"],
      effects: [
        ...pieces.open.effects,
        "swipeTracking",
        "measureSize",
        "nestedMetrics",
        "keyboardInset",
        "onlyWayOut",
      ],
      on: {
        ...pieces.open.on,
        SWIPE: [
          {
            guard: "swipeDismisses",
            target: "closed",
            reason: "swipe",
            actions: ["releaseToClose", "setCloseReason"],
          },
          { reason: "swipe", actions: ["settleSnapPoint", "endSwipe"] },
        ],
        "SWIPE.START": { actions: ["startSwipe"] },
        "SWIPE.CANCEL": { actions: ["endSwipe"] },
        HANDLE_PRESS: { guard: "hasSnapPoints", reason: "handle", actions: ["cycleSnapPoint"] },
        "SNAP_POINT.SET": { reason: "api", actions: ["setSnapPoint"] },
        "SIZE.CHANGE": { actions: ["setSizes"] },
        "NESTED.CHANGE": { actions: ["setNested"] },
      },
    },
  },
})

export type DrawerMachine = typeof drawerMachine
