// Image Viewer (add-image-viewer design §2): an image zoomed and panned in its viewport.
// Every change goes through one commit (clamp the zoom, zoom about the anchor, clamp the pan),
// so programmatic zoom respects the bounds (PhotoSwipe #2187) and a pinch never overshoots a
// limit (yet-another-react-lightbox #380). Keyboard and button changes are announced once,
// after a quiet 500 ms.

import type { AnnouncerEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import { type Point, type Size, zoomAt } from "../image-cropper/geometry"
import { clampPan, panRoom, viewerPlacement } from "./image-viewer.geometry"
import type { ImageViewerMessages } from "./image-viewer.messages"

export type ZoomSource = "key" | "button" | "pointer"

export type ImageViewerEvent =
  | { readonly type: "IMAGE.LOADED"; readonly width: number; readonly height: number }
  | { readonly type: "VIEWPORT.MEASURED"; readonly width: number; readonly height: number }
  /** + / − keys or buttons (about the centre), or a wheel notch at `at`. */
  | {
      readonly type: "ZOOM.STEP"
      readonly direction: 1 | -1
      readonly source: ZoomSource
      readonly at?: Point | undefined
    }
  /** Multiply the zoom (ctrl-wheel, trackpad pinch) about `at`. */
  | { readonly type: "ZOOM.BY"; readonly factor: number; readonly at: Point }
  /** Double click: fit ↔ doubleClickZoom about `at`. */
  | { readonly type: "TOGGLE"; readonly at: Point }
  /** Arrow keys (viewport px; positive moves the view right / down). */
  | { readonly type: "PAN.KEY"; readonly dx: number; readonly dy: number }
  | { readonly type: "DRAG.START"; readonly x: number; readonly y: number }
  | { readonly type: "DRAG.MOVE"; readonly x: number; readonly y: number }
  | { readonly type: "DRAG.END" }
  | { readonly type: "PINCH.START"; readonly distance: number }
  | { readonly type: "PINCH.MOVE"; readonly distance: number; readonly center: Point }
  | { readonly type: "PINCH.END" }
  | { readonly type: "RESET"; readonly source: ZoomSource }
  /** The controlled zoom changed (onProps). */
  | { readonly type: "SYNCED" }

export interface ImageViewerProps {
  readonly id: string
  readonly zoom?: number | undefined
  readonly defaultZoom?: number | undefined
  readonly onZoomChange?:
    | ((zoom: number, details: ChangeDetails<ImageViewerEvent>) => void)
    | undefined
  readonly minZoom?: number | undefined
  readonly maxZoom?: number | undefined
  /** + / − and the buttons (default 0.5). */
  readonly step?: number | undefined
  /** Double click's zoom (default 2). */
  readonly doubleClickZoom?: number | undefined
  readonly messages: ImageViewerMessages
  readonly lang?: string | undefined
}

export interface ImageViewerContext {
  readonly natural: Size
  readonly viewport: Size
  readonly offset: Point
  readonly drag: { readonly start: Point; readonly offset: Point } | null
  readonly pinch: { readonly distance: number; readonly zoom: number } | null
}

type Types = {
  props: ImageViewerProps
  events: ImageViewerEvent
  env: AnnouncerEnv & SchedulerEnv
  context: ImageViewerContext
  values: "zoom"
}
type Args = ActionArgs<Types>

export const minZoomOf = (props: ImageViewerProps) => props.minZoom ?? 1
export const maxZoomOf = (props: ImageViewerProps) => props.maxZoom ?? 4

const ready = (c: ImageViewerContext) =>
  c.natural.width > 0 && c.viewport.width > 0 && c.viewport.height > 0

const centre = (c: ImageViewerContext): Point => ({
  x: c.viewport.width / 2,
  y: c.viewport.height / 2,
})

/** The pan room at the current zoom (for the keys and the connect). */
export const roomOf = (zoom: number, c: ImageViewerContext) =>
  panRoom(viewerPlacement(c.natural, c.viewport, zoom, c.offset))

/** Clamps the zoom, zooms about `anchor`, clamps the pan; writes what changed. */
function commit(args: Args, zoom: number, anchor: Point, offset?: Point) {
  const { context, props, values, set } = args
  const z = Math.min(maxZoomOf(props), Math.max(minZoomOf(props), zoom))
  const from = viewerPlacement(
    context.natural,
    context.viewport,
    values.zoom,
    offset ?? context.offset,
  )
  const p = clampPan(ready(context) ? zoomAt(from, z, anchor) : { ...from, zoom: z })
  if (p.offset.x !== context.offset.x || p.offset.y !== context.offset.y) set("offset", p.offset)
  if (z !== values.zoom) set("zoom", z)
}

export const imageViewerMachine = setup({
  types: type<Types>(),
  guards: {
    ready: ({ context }) => ready(context),
    readyAfterLoad: ({ context, event }) =>
      event.type === "IMAGE.LOADED" && event.width > 0 && context.viewport.width > 0,
    readyAfterMeasure: ({ context, event }) =>
      event.type === "VIEWPORT.MEASURED" && event.width > 0 && context.natural.width > 0,
    announced: ({ event, context }) =>
      ready(context) &&
      (event.type === "ZOOM.STEP" || event.type === "RESET") &&
      event.source !== "pointer",
    zoomed: ({ values, props }) => values.zoom > minZoomOf(props),
  },
  actions: {
    loaded: ({ event, set }) => {
      if (event.type === "IMAGE.LOADED")
        set("natural", { width: event.width, height: event.height })
    },
    measured: ({ event, set }) => {
      if (event.type === "VIEWPORT.MEASURED") {
        set("viewport", { width: event.width, height: event.height })
      }
    },
    /** After a layout or a controlled zoom: the same zoom, the pan clamped to the new room. */
    fit: (args) => commit(args, args.values.zoom, centre(args.context)),
    zoomStep: (args) => {
      const { event, props, values, context } = args
      if (event.type !== "ZOOM.STEP") return
      commit(args, values.zoom + (props.step ?? 0.5) * event.direction, event.at ?? centre(context))
    },
    zoomBy: (args) => {
      if (args.event.type === "ZOOM.BY") {
        commit(args, args.values.zoom * args.event.factor, args.event.at)
      }
    },
    toggle: (args) => {
      const { event, props, values } = args
      if (event.type !== "TOGGLE") return
      const fit = minZoomOf(props)
      commit(args, values.zoom > fit ? fit : (props.doubleClickZoom ?? 2), event.at)
    },
    panKey: (args) => {
      const { event, context } = args
      if (event.type !== "PAN.KEY") return
      // The view moves with the arrow: the image moves the other way.
      commit(args, args.values.zoom, centre(context), {
        x: context.offset.x - event.dx,
        y: context.offset.y - event.dy,
      })
    },
    dragStart: ({ event, set, context }) => {
      if (event.type === "DRAG.START") {
        set("drag", { start: { x: event.x, y: event.y }, offset: context.offset })
      }
    },
    dragMove: (args) => {
      const { event, context } = args
      const drag = context.drag
      if (event.type !== "DRAG.MOVE" || !drag) return
      commit(args, args.values.zoom, centre(context), {
        x: drag.offset.x + event.x - drag.start.x,
        y: drag.offset.y + event.y - drag.start.y,
      })
    },
    dragEnd: ({ set }) => set("drag", null),
    pinchStart: ({ event, set, values }) => {
      if (event.type === "PINCH.START")
        set("pinch", { distance: event.distance, zoom: values.zoom })
    },
    pinchMove: (args) => {
      const { event, context } = args
      if (event.type !== "PINCH.MOVE" || !context.pinch || context.pinch.distance <= 0) return
      commit(args, context.pinch.zoom * (event.distance / context.pinch.distance), event.center)
    },
    pinchEnd: ({ set }) => set("pinch", null),
    reset: (args) =>
      commit(args, args.props.defaultZoom ?? minZoomOf(args.props), centre(args.context), {
        x: 0,
        y: 0,
      }),
    announce: ({ env, props, values }) => {
      env.announcer.announce({
        message: props.messages.zoomAnnouncement(values.zoom, props.lang ?? "en"),
        priority: "polite",
        key: `image-viewer-${props.id}`,
        ...(props.lang === undefined ? {} : { lang: props.lang }),
      })
    },
  },
  delays: { quiet: () => 500 },
}).machine({
  id: "image-viewer",
  initial: "loading",
  context: () => ({
    natural: { width: 0, height: 0 },
    viewport: { width: 0, height: 0 },
    offset: { x: 0, y: 0 },
    drag: null,
    pinch: null,
  }),
  values: { zoom: { fallback: 1 } },
  onProps: { zoom: "SYNCED" },
  on: {
    "IMAGE.LOADED": { actions: ["loaded", "fit"] },
    "VIEWPORT.MEASURED": { actions: ["measured", "fit"] },
    "ZOOM.BY": { guard: "ready", actions: ["zoomBy"] },
    TOGGLE: { guard: "ready", actions: ["toggle"] },
    "PINCH.START": { actions: ["pinchStart"] },
    "PINCH.MOVE": { guard: "ready", actions: ["pinchMove"] },
    "PINCH.END": { actions: ["pinchEnd"] },
    SYNCED: { actions: ["fit"] },
  },
  states: {
    /** Until the image has loaded and the viewport is measured. */
    loading: {
      on: {
        "IMAGE.LOADED": [
          { guard: "readyAfterLoad", target: "idle", actions: ["loaded", "fit"] },
          { actions: ["loaded"] },
        ],
        "VIEWPORT.MEASURED": [
          { guard: "readyAfterMeasure", target: "idle", actions: ["measured", "fit"] },
          { actions: ["measured"] },
        ],
      },
    },
    idle: {
      on: {
        "ZOOM.STEP": [
          { guard: "announced", target: "settling", actions: ["zoomStep"] },
          { guard: "ready", actions: ["zoomStep"] },
        ],
        RESET: [
          { guard: "announced", target: "settling", actions: ["reset"] },
          { guard: "ready", actions: ["reset"] },
        ],
        "PAN.KEY": { guard: "ready", actions: ["panKey"] },
        "DRAG.START": { guard: "zoomed", target: "panning", actions: ["dragStart"] },
      },
    },
    panning: {
      on: {
        "DRAG.MOVE": { actions: ["dragMove"] },
        "DRAG.END": { target: "idle", actions: ["dragEnd"] },
        // The wheel works during a drag (react-zoom-pan-pinch #543).
        "ZOOM.STEP": { guard: "ready", actions: ["zoomStep"] },
      },
    },
    /** A keyboard or button change waits for a quiet moment before it is announced. */
    settling: {
      after: { quiet: { target: "idle", actions: ["announce"] } },
      on: {
        "ZOOM.STEP": { guard: "ready", target: "settling", reenter: true, actions: ["zoomStep"] },
        RESET: { guard: "ready", target: "settling", reenter: true, actions: ["reset"] },
        "PAN.KEY": { guard: "ready", actions: ["panKey"] },
        "DRAG.START": { guard: "zoomed", target: "panning", actions: ["dragStart"] },
      },
    },
  },
})

export type ImageViewerMachine = typeof imageViewerMachine
