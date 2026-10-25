/** @jsxImportSource solid-js */
import {
  announcerCapability,
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
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
  readonly api: Accessor<Api>
  readonly state: ImageCropperRenderState
  readonly send: (event: ImageCropperEvent) => void
  readonly steps: Accessor<{ readonly base: number; readonly shift: number; readonly ctrl: number }>
}
const ImageCropperContext = createContext<Ctx>()
function useCropper(part: string): Ctx {
  const ctx = useContext(ImageCropperContext)
  if (!ctx) throw new Error(`ImageCropper.${part} must be inside ImageCropper.Root`)
  return ctx
}

export type ImageCropperRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Controlled crop, viewport px. */
  readonly crop?: Rect | undefined
  readonly defaultCrop?: Rect | undefined
  /** `details.data`: the crop in natural pixels (`rect`, `corners`). */
  readonly onCropChange?: ((crop: Rect, details: ImageCropperChangeDetails) => void) | undefined
  readonly zoom?: number | undefined
  readonly defaultZoom?: number | undefined
  readonly onZoomChange?: ((zoom: number, details: ImageCropperChangeDetails) => void) | undefined
  /** Degrees, any angle. */
  readonly rotation?: number | undefined
  readonly defaultRotation?: number | undefined
  readonly onRotationChange?:
    | ((rotation: number, details: ImageCropperChangeDetails) => void)
    | undefined
  readonly flip?: Flip | undefined
  readonly defaultFlip?: Flip | undefined
  readonly onFlipChange?: ((flip: Flip, details: ImageCropperChangeDetails) => void) | undefined
  /** Smallest zoom (default 1). */
  readonly minZoom?: number | undefined
  /** Largest zoom (default 5). */
  readonly maxZoom?: number | undefined
  /** Per wheel notch and per + / − (default 0.1). */
  readonly zoomStep?: number | undefined
  /** Pinch responsiveness (default 2). */
  readonly zoomSensitivity?: number | undefined
  /** Width / height; free when omitted. */
  readonly aspectRatio?: number | undefined
  /** A circle implies aspect 1. */
  readonly cropShape?: "rectangle" | "circle" | undefined
  /** Viewport px (default 40). */
  readonly minWidth?: number | undefined
  /** Viewport px (default 40). */
  readonly minHeight?: number | undefined
  /** Viewport px (default Infinity). */
  readonly maxWidth?: number | undefined
  /** Viewport px (default Infinity). */
  readonly maxHeight?: number | undefined
  /** The crop stays; drags and arrows pan the image. */
  readonly fixedCropArea?: boolean | undefined
  /** Arrow step, px (default 1). */
  readonly nudgeStep?: number | undefined
  /** Shift+arrow step, px (default 10). */
  readonly nudgeStepShift?: number | undefined
  /** Ctrl/Cmd+arrow step, px (default 50). */
  readonly nudgeStepCtrl?: number | undefined
  readonly messages?: MessageOverrides<ImageCropperMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ImageCropperRenderState> | undefined
  readonly children?: JSX.Element
}

const ROOT_KEYS = [
  "crop",
  "defaultCrop",
  "onCropChange",
  "zoom",
  "defaultZoom",
  "onZoomChange",
  "rotation",
  "defaultRotation",
  "onRotationChange",
  "flip",
  "defaultFlip",
  "onFlipChange",
  "minZoom",
  "maxZoom",
  "zoomStep",
  "zoomSensitivity",
  "aspectRatio",
  "cropShape",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "fixedCropArea",
  "nudgeStep",
  "nudgeStepShift",
  "nudgeStepCtrl",
  "messages",
  "locale",
  "render",
  "id",
  "children",
] as const

function Root(props: ImageCropperRootProps) {
  const [local, rest] = splitProps(props, ROOT_KEYS)
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => local.id)
  const loc = useLocale(() => local.locale)
  const messages = useMessages("image-cropper", imageCropperMessages, () => local.messages)
  // The machine reports the natural-pixel crop of the placement it is about to write, so the
  // value callbacks always get the current data (never the previous render's).
  let latestData: CropData | null = null
  const machineEnv = {
    ...env,
    onData: (data: CropData) => {
      latestData = data
    },
  }
  const withData =
    <V,>(cb: () => ((value: V, details: ImageCropperChangeDetails) => void) | undefined) =>
    (value: V, details: ChangeDetails<ImageCropperEvent>) =>
      cb()?.(value, { ...details, data: latestData })
  const cropShape = () => local.cropShape ?? "rectangle"
  const fixed = () => local.fixedCropArea === true
  const machineProps = createMemo(() => ({
    id: instance(),
    crop: local.crop,
    defaultCrop: local.defaultCrop,
    onCropChange: withData<Rect>(() => local.onCropChange),
    zoom: local.zoom,
    defaultZoom: local.defaultZoom,
    onZoomChange: withData<number>(() => local.onZoomChange),
    rotation: local.rotation,
    defaultRotation: local.defaultRotation,
    onRotationChange: withData<number>(() => local.onRotationChange),
    flip: local.flip,
    defaultFlip: local.defaultFlip,
    onFlipChange: withData<Flip>(() => local.onFlipChange),
    minZoom: local.minZoom,
    maxZoom: local.maxZoom,
    zoomStep: local.zoomStep,
    zoomSensitivity: local.zoomSensitivity,
    aspectRatio: local.aspectRatio,
    cropShape: cropShape(),
    minWidth: local.minWidth,
    minHeight: local.minHeight,
    maxWidth: local.maxWidth,
    maxHeight: local.maxHeight,
    fixedCropArea: fixed(),
    messages: messages(),
    lang: loc().locale,
  }))
  const { view, send } = useMachine(imageCropperMachine, machineProps, machineEnv)
  const placement = createMemo(() => cropPlacementOf(view().values, view().context))
  const ready = () => view().state !== "loading"
  const api = createMemo(() =>
    imageCropperConnect({
      instance: instance(),
      state: view().state as "loading" | "idle" | "dragging" | "settling",
      placement: placement(),
      crop: view().values.crop,
      shape: cropShape(),
      fixed: fixed(),
      dragging: view().state === "dragging" && view().context.drag?.target !== "image",
      panning: view().state === "dragging" && view().context.drag?.target === "image",
      ready: ready(),
      ids: { instructions: partId("image-cropper", instance(), "instructions") },
      messages: messages(),
      locale: loc().locale,
    }),
  )
  const state = reactive<ImageCropperRenderState>(() => ({
    data: ready() ? cropData(placement(), view().values.crop) : null,
    zoom: view().values.zoom,
    rotation: view().values.rotation,
    flip: view().values.flip,
    dragging: view().state === "dragging",
  }))
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const instructions = createMemo(() => normalizeProps(api().instructions()))
  const children = () => (
    <>
      {local.children}
      <span {...instructions()}>{api().instructionsText}</span>
    </>
  )
  return (
    <ImageCropperContext.Provider
      value={{
        api,
        state,
        send,
        steps: () => ({
          base: local.nudgeStep ?? 1,
          shift: local.nudgeStepShift ?? 10,
          ctrl: local.nudgeStepCtrl ?? 50,
        }),
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ImageCropperContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ImageCropperRenderState> | undefined
  readonly children?: JSX.Element
}

function Viewport(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCropper("Viewport")
  const [el, setEl] = createSignal<Element | null>(null)
  const { send } = ctx
  afterMount(() => {
    createEffect(() => {
      const viewport = el()
      if (!(viewport instanceof HTMLElement)) return
      onCleanup(
        cropGestures(viewport, {
          onSize: (s) => send({ type: "VIEWPORT.MEASURED", ...s }),
          onDragStart: (target, x, y) => send({ type: "DRAG.START", target, x, y }),
          onDragMove: (x, y, lockRatio) => send({ type: "DRAG.MOVE", x, y, lockRatio }),
          onDragEnd: () => send({ type: "DRAG.END" }),
          onWheel: (direction, at) => send({ type: "ZOOM.STEP", direction, at }),
          onPinchStart: (distance) => send({ type: "PINCH.START", distance }),
          onPinchMove: (distance, center) => send({ type: "PINCH.MOVE", distance, center }),
          onPinchEnd: () => send({ type: "PINCH.END" }),
        }),
      )
    })
  })
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().viewport()), ref: setEl }, rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Image(props: Omit<PartProps<JSX.ImgHTMLAttributes<HTMLImageElement>>, "children">) {
  const [local, rest] = splitProps(props, ["render"])
  const ctx = useCropper("Image")
  const [el, setEl] = createSignal<Element | null>(null)
  const { send } = ctx
  // An image already decoded before hydration fires no load event.
  afterMount(() => {
    const img = untrack(el)
    if (img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0) {
      send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
    }
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().image()), {
          onLoad: (e: Event) => {
            const img = e.currentTarget as HTMLImageElement
            send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
          },
        }),
        ref: setEl,
      },
      rest,
    ),
  )
  return renderPart(
    local.render,
    merged,
    ctx.state,
    () => undefined,
    // biome-ignore lint/a11y/useAltText: the connect props carry the alt (decorative), the consumer's win
    (p) => <img {...p} />,
  )
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function Selection(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCropper("Selection")
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().selection({ focused: focused(), modality: modality() })),
        {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
          onKeyDown: (e: KeyboardEvent) => {
            const arrow = ARROWS[e.key]
            if (arrow) {
              e.preventDefault()
              // Modifiers from the event itself (never a remembered keys-down set).
              const steps = untrack(ctx.steps)
              const step =
                e.ctrlKey || e.metaKey ? steps.ctrl : e.shiftKey ? steps.shift : steps.base
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
        },
      ),
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ImageCropperHandleProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The edge or corner it resizes: n, s, e, w, ne, nw, se or sw. */
  readonly position: HandlePosition
}

function Handle(props: ImageCropperHandleProps) {
  const [local, rest] = splitProps(props, ["render", "position", "children"])
  const ctx = useCropper("Handle")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().handle(local.position)), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ImageCropperGridProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Which thirds lines it draws. */
  readonly axis: "horizontal" | "vertical"
}

function Grid(props: ImageCropperGridProps) {
  const [local, rest] = splitProps(props, ["render", "axis", "children"])
  const ctx = useCropper("Grid")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().grid(local.axis)), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The parts, by name: `image-cropper.parts.ts` re-exports them as the `ImageCropper` namespace. */
export { Grid, Handle, Image, Root, Selection, Viewport }
