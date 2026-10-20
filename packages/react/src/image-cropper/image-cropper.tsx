"use client"

import {
  type ChangeDetails,
  type CropData,
  cropData,
  cropGestures,
  cropPlacementOf,
  type Flip,
  type HandlePosition,
  type ImageCropperEvent,
  type ImageCropperMessages,
  imageCropperConnect,
  imageCropperMachine,
  imageCropperMessages,
  type MessageOverrides,
  partId,
  type Rect,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "image-cropper": ImageCropperMessages
  }
}

/** What every part's `render` receives. */
export interface ImageCropperRenderState {
  /** The crop in natural pixels. */
  readonly data: CropData | null
  readonly zoom: number
  readonly rotation: number
  readonly flip: Flip
  readonly dragging: boolean
}

/** The change details every value callback receives: the crop in natural pixels too. */
export interface ImageCropperChangeDetails extends ChangeDetails<ImageCropperEvent> {
  readonly data: CropData | null
}

type Api = ReturnType<typeof imageCropperConnect>

interface Ctx {
  readonly api: Api
  readonly state: ImageCropperRenderState
  readonly send: (event: ImageCropperEvent) => void
  readonly steps: { readonly base: number; readonly shift: number; readonly ctrl: number }
}
const ImageCropperContext = createContext<Ctx | null>(null)
function useCropper(part: string): Ctx {
  const ctx = useContext(ImageCropperContext)
  if (!ctx) throw new Error(`ImageCropper.${part} must be inside ImageCropper.Root`)
  return ctx
}

export type ImageCropperRootProps = ComponentPropsWithRef<"div"> & {
  /** Controlled crop, viewport px. */
  readonly crop?: Rect
  readonly defaultCrop?: Rect
  /** `details.data`: the crop in natural pixels (`rect`, `corners`). */
  readonly onCropChange?: (crop: Rect, details: ImageCropperChangeDetails) => void
  readonly zoom?: number
  readonly defaultZoom?: number
  readonly onZoomChange?: (zoom: number, details: ImageCropperChangeDetails) => void
  /** Degrees, any angle. */
  readonly rotation?: number
  readonly defaultRotation?: number
  readonly onRotationChange?: (rotation: number, details: ImageCropperChangeDetails) => void
  readonly flip?: Flip
  readonly defaultFlip?: Flip
  readonly onFlipChange?: (flip: Flip, details: ImageCropperChangeDetails) => void
  /** Smallest zoom (default 1). */
  readonly minZoom?: number
  /** Largest zoom (default 5). */
  readonly maxZoom?: number
  /** Per wheel notch and per + / − (default 0.1). */
  readonly zoomStep?: number
  /** Pinch responsiveness (default 2). */
  readonly zoomSensitivity?: number
  /** Width / height; free when omitted. */
  readonly aspectRatio?: number
  /** A circle implies aspect 1. */
  readonly cropShape?: "rectangle" | "circle"
  /** Viewport px (default 40). */
  readonly minWidth?: number
  /** Viewport px (default 40). */
  readonly minHeight?: number
  /** Viewport px (default Infinity). */
  readonly maxWidth?: number
  /** Viewport px (default Infinity). */
  readonly maxHeight?: number
  /** The crop stays; drags and arrows pan the image. */
  readonly fixedCropArea?: boolean
  /** Arrow step, px (default 1). */
  readonly nudgeStep?: number
  /** Shift+arrow step, px (default 10). */
  readonly nudgeStepShift?: number
  /** Ctrl/Cmd+arrow step, px (default 50). */
  readonly nudgeStepCtrl?: number
  readonly messages?: MessageOverrides<ImageCropperMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<ImageCropperRenderState>
}

function Root(props: ImageCropperRootProps) {
  const {
    crop,
    defaultCrop,
    onCropChange,
    zoom,
    defaultZoom,
    onZoomChange,
    rotation,
    defaultRotation,
    onRotationChange,
    flip,
    defaultFlip,
    onFlipChange,
    minZoom,
    maxZoom,
    zoomStep,
    zoomSensitivity,
    aspectRatio,
    cropShape = "rectangle",
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    fixedCropArea = false,
    nudgeStep = 1,
    nudgeStepShift = 10,
    nudgeStepCtrl = 50,
    messages: ownMessages,
    locale: ownLocale,
    render,
    id,
    ref,
    children,
    ...rest
  } = props
  const env = useEnvironment()
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("image-cropper", imageCropperMessages, ownMessages)
  // The machine reports the natural-pixel crop of the placement it is about to write, so the
  // value callbacks always get the current data (never the previous render's).
  const latestData = useRef<CropData | null>(null)
  const [machineEnv] = useState(() => ({
    ...env,
    onData: (data: CropData) => {
      latestData.current = data
    },
  }))
  const withData =
    <V,>(cb: ((value: V, details: ImageCropperChangeDetails) => void) | undefined) =>
    (value: V, details: ChangeDetails<ImageCropperEvent>) =>
      cb?.(value, { ...details, data: latestData.current })
  const machineProps = {
    id: instance,
    crop,
    defaultCrop,
    onCropChange: withData<Rect>(onCropChange),
    zoom,
    defaultZoom,
    onZoomChange: withData<number>(onZoomChange),
    rotation,
    defaultRotation,
    onRotationChange: withData<number>(onRotationChange),
    flip,
    defaultFlip,
    onFlipChange: withData<Flip>(onFlipChange),
    minZoom,
    maxZoom,
    zoomStep,
    zoomSensitivity,
    aspectRatio,
    cropShape,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    fixedCropArea,
    messages,
    lang: locale,
  }
  const { view, send } = useMachine(imageCropperMachine, machineProps, machineEnv)
  const placement = cropPlacementOf(view.values, view.context)
  const ready = view.state !== "loading"
  const api = imageCropperConnect({
    instance,
    state: view.state as "loading" | "idle" | "dragging" | "settling",
    placement,
    crop: view.values.crop,
    shape: cropShape,
    fixed: fixedCropArea,
    dragging: view.state === "dragging" && view.context.drag?.target !== "image",
    panning: view.state === "dragging" && view.context.drag?.target === "image",
    ready,
    ids: { instructions: partId("image-cropper", instance, "instructions") },
    messages,
    locale,
  })
  const state: ImageCropperRenderState = {
    data: ready ? cropData(placement, view.values.crop) : null,
    zoom: view.values.zoom,
    rotation: view.values.rotation,
    flip: view.values.flip,
    dragging: view.state === "dragging",
  }
  const rootProps = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <ImageCropperContext
      value={{
        api,
        state,
        send,
        steps: { base: nudgeStep, shift: nudgeStepShift, ctrl: nudgeStepCtrl },
      }}
    >
      {renderPart(
        "div",
        {
          ...rootProps,
          children: (
            <>
              {children}
              <span {...normalizeProps(api.instructions())}>{api.instructionsText}</span>
            </>
          ),
        },
        render,
        state,
      )}
    </ImageCropperContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<ImageCropperRenderState>
}

function Viewport({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useCropper("Viewport")
  const el = useRef<HTMLDivElement | null>(null)
  const { send } = ctx
  useEffect(() => {
    const viewport = el.current
    if (!viewport) return
    return cropGestures(viewport, {
      onSize: (s) => send({ type: "VIEWPORT.MEASURED", ...s }),
      onDragStart: (target, x, y) => send({ type: "DRAG.START", target, x, y }),
      onDragMove: (x, y, lockRatio) => send({ type: "DRAG.MOVE", x, y, lockRatio }),
      onDragEnd: () => send({ type: "DRAG.END" }),
      onWheel: (direction, at) => send({ type: "ZOOM.STEP", direction, at }),
      onPinchStart: (distance) => send({ type: "PINCH.START", distance }),
      onPinchMove: (distance, center) => send({ type: "PINCH.MOVE", distance, center }),
      onPinchEnd: () => send({ type: "PINCH.END" }),
    })
  }, [send])
  const props = mergeProps(
    { ...normalizeProps(ctx.api.viewport()), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart("div", { ...props, children }, render, ctx.state)
}

function Image({ render, ref, onLoad, ...rest }: PartProps<"img">) {
  const ctx = useCropper("Image")
  const el = useRef<HTMLImageElement | null>(null)
  const { send } = ctx
  // An image already decoded before hydration fires no load event.
  useEffect(() => {
    const img = el.current
    if (img?.complete && img.naturalWidth > 0) {
      send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
    }
  }, [send])
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.image()), {
        onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
          const img = e.currentTarget
          send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
        },
      }),
      ref: composeRefs(el, ref),
    },
    rest,
    onLoad ? { onLoad } : {},
  )
  return renderPart("img", props, render, ctx.state)
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function Selection({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useCropper("Selection")
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.selection({ focused, modality })), {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onKeyDown: (e: React.KeyboardEvent) => {
          const arrow = ARROWS[e.key]
          if (arrow) {
            e.preventDefault()
            // Modifiers from the event itself (never a remembered keys-down set).
            const step =
              e.ctrlKey || e.metaKey
                ? ctx.steps.ctrl
                : e.shiftKey
                  ? ctx.steps.shift
                  : ctx.steps.base
            ctx.send({
              type: "KEY.NUDGE",
              dx: arrow[0] * step,
              dy: arrow[1] * step,
              resize: e.altKey,
            })
            return
          }
          if (e.key === "+" || e.key === "=") {
            e.preventDefault()
            ctx.send({ type: "ZOOM.STEP", direction: 1 })
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault()
            ctx.send({ type: "ZOOM.STEP", direction: -1 })
          }
        },
      }),
      ref,
    },
    rest,
  )
  return renderPart("div", { ...props, children }, render, ctx.state)
}

export type ImageCropperHandleProps = PartProps<"div"> & {
  /** The edge or corner it resizes: n, s, e, w, ne, nw, se or sw. */
  readonly position: HandlePosition
}

function Handle({ render, position, ...rest }: ImageCropperHandleProps) {
  const ctx = useCropper("Handle")
  return renderPart(
    "div",
    mergeProps(normalizeProps(ctx.api.handle(position)), rest),
    render,
    ctx.state,
  )
}

export type ImageCropperGridProps = PartProps<"div"> & {
  /** Which thirds lines it draws. */
  readonly axis: "horizontal" | "vertical"
}

function Grid({ render, axis, ...rest }: ImageCropperGridProps) {
  const ctx = useCropper("Grid")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.grid(axis)), rest), render, ctx.state)
}

export const ImageCropper = { Root, Viewport, Image, Selection, Handle, Grid }
