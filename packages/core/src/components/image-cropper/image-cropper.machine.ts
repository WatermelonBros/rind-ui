// Image Cropper (add-image-cropper design §3): the crop in viewport pixels over an image placed
// by zoom, rotation, flip and a pan offset. Every change goes through the pure geometry,
// which keeps the image covering the crop. A keyboard change is announced once, after a
// quiet 500 ms; the DOM layer reports measurements, pointers, wheel and pinch.

import type { AnnouncerEnv, SchedulerEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import type { ActionArgs, ChangeDetails } from "../../machine/types"
import {
  type CropData,
  type CropPlacement,
  constrainPlacement,
  cropData,
  defaultCrop,
  type Flip,
  type HandlePosition,
  moveCrop,
  type Point,
  type Rect,
  resizeCrop,
  type Size,
  zoomAt,
} from "./geometry"
import type { ImageCropperMessages } from "./image-cropper.messages"

export type DragTarget = "selection" | "image" | HandlePosition

export type ImageCropperEvent =
  | { readonly type: "IMAGE.LOADED"; readonly width: number; readonly height: number }
  | { readonly type: "VIEWPORT.MEASURED"; readonly width: number; readonly height: number }
  /** Arrow keys on the selection (viewport px); `resize`: Alt held. */
  | {
      readonly type: "KEY.NUDGE"
      readonly dx: number
      readonly dy: number
      readonly resize: boolean
    }
  /** + / − keys, or a wheel notch at `at` (viewport px). */
  | { readonly type: "ZOOM.STEP"; readonly direction: 1 | -1; readonly at?: Point | undefined }
  | {
      readonly type: "DRAG.START"
      readonly target: DragTarget
      readonly x: number
      readonly y: number
    }
  /** `lockRatio`: Shift held while resizing. */
  | {
      readonly type: "DRAG.MOVE"
      readonly x: number
      readonly y: number
      readonly lockRatio: boolean
    }
  | { readonly type: "DRAG.END" }
  | { readonly type: "PINCH.START"; readonly distance: number }
  | { readonly type: "PINCH.MOVE"; readonly distance: number; readonly center: Point }
  | { readonly type: "PINCH.END" }
  | { readonly type: "RESET" }
  /** A controlled value changed (onProps). */
  | { readonly type: "SYNCED" }
  /** Internal: re-fits the placement after a value changed. */
  | { readonly type: "FIT" }

export interface ImageCropperProps {
  readonly id: string
  readonly crop?: Rect | undefined
  readonly defaultCrop?: Rect | undefined
  readonly onCropChange?:
    | ((crop: Rect, details: ChangeDetails<ImageCropperEvent>) => void)
    | undefined
  readonly zoom?: number | undefined
  readonly defaultZoom?: number | undefined
  readonly onZoomChange?:
    | ((zoom: number, details: ChangeDetails<ImageCropperEvent>) => void)
    | undefined
  readonly rotation?: number | undefined
  readonly defaultRotation?: number | undefined
  readonly onRotationChange?:
    | ((rotation: number, details: ChangeDetails<ImageCropperEvent>) => void)
    | undefined
  readonly flip?: Flip | undefined
  readonly defaultFlip?: Flip | undefined
  readonly onFlipChange?:
    | ((flip: Flip, details: ChangeDetails<ImageCropperEvent>) => void)
    | undefined
  readonly minZoom?: number | undefined
  readonly maxZoom?: number | undefined
  readonly zoomStep?: number | undefined
  readonly zoomSensitivity?: number | undefined
  readonly aspectRatio?: number | undefined
  readonly cropShape?: "rectangle" | "circle" | undefined
  readonly minWidth?: number | undefined
  readonly minHeight?: number | undefined
  readonly maxWidth?: number | undefined
  readonly maxHeight?: number | undefined
  readonly fixedCropArea?: boolean | undefined
  readonly messages: ImageCropperMessages
  readonly lang?: string | undefined
}

/** What the machine reaches the DOM layer through (injected; absent in Node). */
export interface ImageCropperEnv {
  /** The crop in natural pixels of the placement about to be written. */
  readonly onData?: ((data: CropData) => void) | undefined
}

interface Drag {
  readonly target: DragTarget
  readonly start: Point
  readonly crop: Rect
  readonly offset: Point
}

export interface ImageCropperContext {
  readonly natural: Size
  readonly viewport: Size
  readonly offset: Point
  readonly drag: Drag | null
  readonly pinch: { readonly distance: number; readonly zoom: number } | null
}

type Types = {
  props: ImageCropperProps
  events: ImageCropperEvent
  env: AnnouncerEnv & SchedulerEnv & ImageCropperEnv
  context: ImageCropperContext
  values: "crop" | "zoom" | "rotation" | "flip"
}
type Args = ActionArgs<Types>

const NO_FLIP: Flip = { horizontal: false, vertical: false }
const EMPTY: Rect = { x: 0, y: 0, width: 0, height: 0 }
const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

export const aspectOf = (props: ImageCropperProps) =>
  props.cropShape === "circle" ? 1 : props.aspectRatio

const maxZoomOf = (props: ImageCropperProps) => props.maxZoom ?? 5
const minZoomOf = (props: ImageCropperProps) => props.minZoom ?? 1

/** The current placement (values + context). */
export function cropPlacementOf(
  values: { readonly zoom: number; readonly rotation: number; readonly flip: Flip },
  context: ImageCropperContext,
): CropPlacement {
  return {
    natural: context.natural,
    viewport: context.viewport,
    zoom: values.zoom,
    rotation: values.rotation,
    flip: values.flip,
    offset: context.offset,
  }
}

const ready = (c: ImageCropperContext) =>
  c.natural.width > 0 && c.viewport.width > 0 && c.viewport.height > 0

/**
 * Writes a placement (zoom and offset) that covers `crop`, and the crop. The natural-pixel
 * data of the final placement is reported first, so value callbacks read the current one.
 */
function commit(args: Args, crop: Rect, p: CropPlacement) {
  const { set, props, env } = args
  const fixed = constrainPlacement(p, crop, maxZoomOf(props))
  env.onData?.(cropData(fixed, crop))
  set("offset", fixed.offset)
  if (fixed.zoom !== args.values.zoom) set("zoom", fixed.zoom)
  if (!sameRect(args.values.crop, crop)) set("crop", crop)
}

const place = (args: Args) => cropPlacementOf(args.values, args.context)

export const imageCropperMachine = setup({
  types: type<Types>(),
  guards: {
    ready: ({ context }) => ready(context),
    readyAfterLoad: ({ context, event }) =>
      event.type === "IMAGE.LOADED" && event.width > 0 && context.viewport.width > 0,
    readyAfterMeasure: ({ context, event }) =>
      event.type === "VIEWPORT.MEASURED" &&
      event.width > 0 &&
      event.height > 0 &&
      context.natural.width > 0,
    /** + / − keys (no pointer position): announced like the arrows; a wheel notch is not. */
    keyZoom: ({ context, event }) => ready(context) && event.type === "ZOOM.STEP" && !event.at,
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
    /** First layout, or the fixed area after a resize: the default crop, then cover it. */
    fit: (args) => {
      if (!ready(args.context)) return
      const { props, values, context } = args
      const needsDefault = props.fixedCropArea === true || values.crop.width <= 0
      const crop = needsDefault
        ? defaultCrop(context.natural, context.viewport, aspectOf(props))
        : values.crop
      commit(args, crop, place(args))
    },
    nudge: (args) => {
      const { event, props, values } = args
      if (event.type !== "KEY.NUDGE") return
      const p = place(args)
      if (props.fixedCropArea) {
        // The crop stays: the image moves the other way, so the view moves with the arrow.
        commit(args, values.crop, {
          ...p,
          offset: { x: p.offset.x - event.dx, y: p.offset.y - event.dy },
        })
        return
      }
      const crop = event.resize
        ? resizeCrop(p, values.crop, "se", event.dx, event.dy, limits(props, values.crop, false))
        : moveCrop(p, values.crop, event.dx, event.dy)
      commit(args, crop, p)
    },
    zoomStep: (args) => {
      const { event, props, values } = args
      if (event.type !== "ZOOM.STEP") return
      const step = props.zoomStep ?? 0.1
      const zoom = Math.min(
        maxZoomOf(props),
        Math.max(minZoomOf(props), values.zoom + step * event.direction),
      )
      const c = values.crop
      const anchor = event.at ?? { x: c.x + c.width / 2, y: c.y + c.height / 2 }
      commit(args, c, zoomAt(place(args), zoom, anchor))
    },
    dragStart: ({ event, set, values, context, props }) => {
      if (event.type !== "DRAG.START") return
      // A fixed crop area never moves or resizes: every drag pans.
      const target = props.fixedCropArea ? "image" : event.target
      set("drag", {
        target,
        start: { x: event.x, y: event.y },
        crop: values.crop,
        offset: context.offset,
      })
    },
    dragMove: (args) => {
      const { event, context, props } = args
      const drag = context.drag
      if (event.type !== "DRAG.MOVE" || !drag) return
      const dx = event.x - drag.start.x
      const dy = event.y - drag.start.y
      const p = place(args)
      if (drag.target === "image") {
        commit(args, args.values.crop, {
          ...p,
          offset: { x: drag.offset.x + dx, y: drag.offset.y + dy },
        })
      } else if (drag.target === "selection") {
        commit(args, moveCrop(p, drag.crop, dx, dy), p)
      } else {
        const crop = resizeCrop(
          p,
          drag.crop,
          drag.target,
          dx,
          dy,
          limits(props, drag.crop, event.lockRatio),
        )
        commit(args, crop, p)
      }
    },
    dragEnd: ({ set }) => set("drag", null),
    pinchStart: ({ event, set, values }) => {
      if (event.type === "PINCH.START")
        set("pinch", { distance: event.distance, zoom: values.zoom })
    },
    pinchMove: (args) => {
      const { event, context, props } = args
      if (event.type !== "PINCH.MOVE" || !context.pinch || context.pinch.distance <= 0) return
      const ratio = (event.distance / context.pinch.distance) ** ((props.zoomSensitivity ?? 2) / 2)
      const zoom = Math.min(
        maxZoomOf(props),
        Math.max(minZoomOf(props), context.pinch.zoom * ratio),
      )
      commit(args, args.values.crop, zoomAt(place(args), zoom, event.center))
    },
    pinchEnd: ({ set }) => set("pinch", null),
    reset: (args) => {
      const { set, props, context } = args
      set("rotation", props.defaultRotation ?? 0)
      set("flip", props.defaultFlip ?? NO_FLIP)
      set("zoom", props.defaultZoom ?? 1)
      set("offset", { x: 0, y: 0 })
      if (ready(context))
        set("crop", defaultCrop(context.natural, context.viewport, aspectOf(props)))
    },
    refit: ({ send }) => send({ type: "FIT" }),
    announce: (args) => {
      const { env, props, context, values } = args
      if (!ready(context)) return
      const rect = cropData(cropPlacementOf(values, context), values.crop).rect
      env.announcer.announce({
        message: props.messages.valueText(rect, props.lang ?? "en"),
        priority: "polite",
        key: `image-cropper-${props.id}`,
        ...(props.lang === undefined ? {} : { lang: props.lang }),
      })
    },
  },
  delays: { quiet: () => 500 },
}).machine({
  id: "image-cropper",
  initial: "loading",
  context: () => ({
    natural: { width: 0, height: 0 },
    viewport: { width: 0, height: 0 },
    offset: { x: 0, y: 0 },
    drag: null,
    pinch: null,
  }),
  values: {
    crop: { fallback: EMPTY, equal: sameRect },
    zoom: { fallback: 1 },
    rotation: { fallback: 0 },
    flip: {
      fallback: NO_FLIP,
      equal: (a, b) => a.horizontal === b.horizontal && a.vertical === b.vertical,
    },
  },
  onProps: {
    crop: "SYNCED",
    zoom: "SYNCED",
    rotation: "SYNCED",
    flip: "SYNCED",
    aspectRatio: "FIT",
    cropShape: "FIT",
    fixedCropArea: "FIT",
  },
  on: {
    "IMAGE.LOADED": { actions: ["loaded", "fit"] },
    "VIEWPORT.MEASURED": { actions: ["measured", "fit"] },
    "ZOOM.STEP": { guard: "ready", actions: ["zoomStep"] },
    "PINCH.START": { actions: ["pinchStart"] },
    "PINCH.MOVE": { guard: "ready", actions: ["pinchMove"] },
    "PINCH.END": { actions: ["pinchEnd"] },
    RESET: { guard: "ready", target: "idle", actions: ["reset", "refit"] },
    SYNCED: { actions: ["fit"] },
    FIT: { actions: ["fit"] },
  },
  states: {
    /** Until the image has loaded and the viewport is measured: nothing to crop yet. */
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
        "KEY.NUDGE": { guard: "ready", target: "settling", actions: ["nudge"] },
        "ZOOM.STEP": [
          { guard: "keyZoom", target: "settling", actions: ["zoomStep"] },
          { guard: "ready", actions: ["zoomStep"] },
        ],
        "DRAG.START": { guard: "ready", target: "dragging", actions: ["dragStart"] },
      },
    },
    dragging: {
      on: {
        "DRAG.MOVE": { actions: ["dragMove"] },
        "DRAG.END": { target: "idle", actions: ["dragEnd"] },
      },
    },
    /** A keyboard change waits for a quiet moment before it is announced. */
    settling: {
      after: { quiet: { target: "idle", actions: ["announce"] } },
      on: {
        "KEY.NUDGE": { guard: "ready", target: "settling", reenter: true, actions: ["nudge"] },
        "ZOOM.STEP": { guard: "ready", target: "settling", reenter: true, actions: ["zoomStep"] },
        "DRAG.START": { guard: "ready", target: "dragging", actions: ["dragStart"] },
      },
    },
  },
})

/** Resize limits: the props', with the start crop's ratio when Shift locks it. */
function limits(props: ImageCropperProps, start: Rect, lockRatio: boolean) {
  const aspect =
    aspectOf(props) ?? (lockRatio && start.height > 0 ? start.width / start.height : undefined)
  return {
    aspect,
    minWidth: props.minWidth ?? 40,
    minHeight: props.minHeight ?? 40,
    maxWidth: props.maxWidth ?? Number.POSITIVE_INFINITY,
    maxHeight: props.maxHeight ?? Number.POSITIVE_INFINITY,
  }
}

export type ImageCropperMachine = typeof imageCropperMachine
