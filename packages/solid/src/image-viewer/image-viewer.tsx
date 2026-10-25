/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
  type ImageViewerEvent,
  type ImageViewerMessages,
  imageViewerConnect,
  imageViewerMachine,
  imageViewerMessages,
  type MessageOverrides,
  maxZoomOf,
  minZoomOf,
  partId,
  roomOf,
  viewerPlacement,
  zoomGestures,
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
    "image-viewer": ImageViewerMessages
  }
}

/** What every part's `render` receives. */
export interface ImageViewerRenderState {
  readonly zoom: number
  readonly zoomed: boolean
  readonly panning: boolean
}

type Api = ReturnType<typeof imageViewerConnect>
type PartPropsOf = ReturnType<Api["zoomIn"]>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: ImageViewerRenderState
  readonly send: (event: ImageViewerEvent) => void
  readonly setLabel: (label: string) => void
  /** Pan room on each axis (px), for the arrow keys. */
  readonly room: Accessor<{ readonly width: number; readonly height: number }>
  readonly viewport: Accessor<{ readonly width: number; readonly height: number }>
  readonly wheelZooms: () => boolean
}
const ImageViewerContext = createContext<Ctx>()
function useViewer(part: string): Ctx {
  const ctx = useContext(ImageViewerContext)
  if (!ctx) throw new Error(`ImageViewer.${part} must be inside ImageViewer.Root`)
  return ctx
}

export type ImageViewerRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Controlled zoom (1 = the image fitted). */
  readonly zoom?: number | undefined
  readonly defaultZoom?: number | undefined
  readonly onZoomChange?:
    | ((zoom: number, details: ChangeDetails<ImageViewerEvent>) => void)
    | undefined
  readonly minZoom?: number | undefined
  readonly maxZoom?: number | undefined
  /** + / − and the buttons (default 0.5). */
  readonly step?: number | undefined
  /** A double click toggles fit and this (default 2). */
  readonly doubleClickZoom?: number | undefined
  /** A plain wheel scrolls the page (default) or zooms; ctrl-wheel and pinch always zoom. */
  readonly wheel?: "page" | "zoom" | undefined
  readonly messages?: MessageOverrides<ImageViewerMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ImageViewerRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: ImageViewerRootProps) {
  const [local, rest] = splitProps(props, [
    "zoom",
    "defaultZoom",
    "onZoomChange",
    "minZoom",
    "maxZoom",
    "step",
    "doubleClickZoom",
    "wheel",
    "messages",
    "locale",
    "render",
    "id",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => local.id)
  const loc = useLocale(() => local.locale)
  const messages = useMessages("image-viewer", imageViewerMessages, () => local.messages)
  const [label, setLabel] = createSignal("")
  // Stable: the gestures effect depends on it (a new function would re-measure every render).
  const wheelZooms = () => local.wheel === "zoom"
  const machineProps = createMemo(() => ({
    id: instance(),
    zoom: local.zoom,
    defaultZoom: local.defaultZoom,
    onZoomChange: local.onZoomChange,
    minZoom: local.minZoom,
    maxZoom: local.maxZoom,
    step: local.step,
    doubleClickZoom: local.doubleClickZoom,
    messages: messages(),
    lang: loc().locale,
  }))
  const { view, send } = useMachine(imageViewerMachine, machineProps, env)
  const current = () => view().values.zoom
  const api = createMemo(() =>
    imageViewerConnect({
      instance: instance(),
      state: view().state as "loading" | "idle" | "panning" | "settling",
      placement: viewerPlacement(
        view().context.natural,
        view().context.viewport,
        current(),
        view().context.offset,
      ),
      minZoom: minZoomOf(machineProps()),
      maxZoom: maxZoomOf(machineProps()),
      label: label(),
      ids: { instructions: partId("image-viewer", instance(), "instructions") },
      messages: messages(),
      locale: loc().locale,
    }),
  )
  const state = reactive<ImageViewerRenderState>(() => ({
    zoom: current(),
    zoomed: current() > minZoomOf(machineProps()),
    panning: view().state === "panning",
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
    <ImageViewerContext.Provider
      value={{
        api,
        state,
        send,
        setLabel,
        room: createMemo(() => roomOf(current(), view().context)),
        viewport: () => view().context.viewport,
        wheelZooms,
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ImageViewerContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<ImageViewerRenderState> | undefined
  readonly children?: JSX.Element
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function Viewport(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useViewer("Viewport")
  const env = useEnvironment()
  const [el, setEl] = createSignal<Element | null>(null)
  const { send, wheelZooms } = ctx
  afterMount(() => {
    createEffect(() => {
      const viewport = el()
      if (!(viewport instanceof HTMLElement)) return
      onCleanup(
        zoomGestures(viewport, {
          onSize: (s) => send({ type: "VIEWPORT.MEASURED", ...s }),
          onDragStart: (x, y) => send({ type: "DRAG.START", x, y }),
          onDragMove: (x, y) => send({ type: "DRAG.MOVE", x, y }),
          onDragEnd: () => send({ type: "DRAG.END" }),
          onZoomBy: (factor, at) => send({ type: "ZOOM.BY", factor, at }),
          onPinchStart: (distance) => send({ type: "PINCH.START", distance }),
          onPinchMove: (distance, center) => send({ type: "PINCH.MOVE", distance, center }),
          onPinchEnd: () => send({ type: "PINCH.END" }),
          onToggle: (at) => send({ type: "TOGGLE", at }),
          wheelZooms,
        }),
      )
    })
    onCleanup(env.modality.subscribe(() => {}))
  })
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(ctx.api().viewport({ focused: focused(), modality: modality() })),
          {
            onFocusIn: (e: FocusEvent) => {
              if (e.target === e.currentTarget) setFocused(true)
            },
            onFocusOut: (e: FocusEvent) => {
              if (e.target === e.currentTarget) setFocused(false)
            },
            onKeyDown: (e: KeyboardEvent) => {
              if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
              if (e.key === "+" || e.key === "=") {
                e.preventDefault()
                send({ type: "ZOOM.STEP", direction: 1, source: "key" })
              } else if (e.key === "-" || e.key === "_") {
                e.preventDefault()
                send({ type: "ZOOM.STEP", direction: -1, source: "key" })
              } else if (e.key === "0") {
                e.preventDefault()
                send({ type: "RESET", source: "key" })
              } else {
                const arrow = ARROWS[e.key]
                if (!arrow) return
                const [ax, ay] = arrow
                const horizontal = ax !== 0
                // Nothing to pan on this axis: the page scrolls.
                const room = untrack(ctx.room)
                if ((horizontal ? room.width : room.height) <= 0) return
                e.preventDefault()
                const share = e.shiftKey ? 0.5 : 0.1
                const viewport = untrack(ctx.viewport)
                send({
                  type: "PAN.KEY",
                  dx: ax * viewport.width * share,
                  dy: ay * viewport.height * share,
                })
              }
            },
          },
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Image(props: Omit<PartProps<JSX.ImgHTMLAttributes<HTMLImageElement>>, "children">) {
  const [local, rest] = splitProps(props, ["render", "alt"])
  const ctx = useViewer("Image")
  const [el, setEl] = createSignal<Element | null>(null)
  const { send, setLabel } = ctx
  // The alt names the viewport (the image itself is hidden: one name, on the focusable group).
  createEffect(() => setLabel(local.alt ?? ""))
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

/** A control button: a no-op while aria-disabled (it keeps its focus at the limit). */
function control(
  name: "ZoomIn" | "ZoomOut" | "Reset",
  propsOf: (api: Api) => PartPropsOf,
  event: ImageViewerEvent,
) {
  return function Control(props: PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useViewer(name)
    const own = createMemo(() => propsOf(ctx.api()))
    // Text children are the name (a visible "+" named "Zoom in" fails label-in-name); the
    // messages' name is for an icon or nothing.
    const text = () => typeof local.children === "string" || typeof local.children === "number"
    const merged = createMemo(() =>
      mergeProps(
        joinHandlers(normalizeProps(text() ? { ...own(), "aria-label": undefined } : own()), {
          onClick: () => {
            if (untrack(own)["aria-disabled"] !== "true") ctx.send(event)
          },
        }),
        rest,
      ),
    )
    const children = () => local.children
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }
}

function ZoomText(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useViewer("ZoomText")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().zoomTextPart()), rest))
  const children = () => local.children ?? ctx.api().zoomText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

const ZoomIn = control("ZoomIn", (api) => api.zoomIn(), {
  type: "ZOOM.STEP",
  direction: 1,
  source: "button",
})
const ZoomOut = control("ZoomOut", (api) => api.zoomOut(), {
  type: "ZOOM.STEP",
  direction: -1,
  source: "button",
})
const Reset = control("Reset", (api) => api.reset(), { type: "RESET", source: "button" })

/** The parts, by name: `image-viewer.parts.ts` re-exports them as the `ImageViewer` namespace. */
export { Image, Reset, Root, Viewport, ZoomIn, ZoomOut, ZoomText }
