"use client"

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
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
    "image-viewer": ImageViewerMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface ImageViewerRenderState {
  readonly zoom: number
  readonly zoomed: boolean
  readonly panning: boolean
}

type Api = ReturnType<typeof imageViewerConnect>
type PartPropsOf = ReturnType<Api["zoomIn"]>

interface Ctx {
  readonly api: Api
  readonly state: ImageViewerRenderState
  readonly send: (event: ImageViewerEvent) => void
  readonly setLabel: (label: string) => void
  /** Pan room on each axis (px), for the arrow keys. */
  readonly room: { readonly width: number; readonly height: number }
  readonly viewport: { readonly width: number; readonly height: number }
  readonly wheelZooms: () => boolean
}
const ImageViewerContext = createContext<Ctx | null>(null)
function useViewer(part: string): Ctx {
  const ctx = useContext(ImageViewerContext)
  if (!ctx) throw new Error(`ImageViewer.${part} must be inside ImageViewer.Root`)
  return ctx
}

export type ImageViewerRootProps = ComponentPropsWithRef<"div"> & {
  /** Controlled zoom (1 = the image fitted). */
  readonly zoom?: number
  readonly defaultZoom?: number
  readonly onZoomChange?: (zoom: number, details: ChangeDetails<ImageViewerEvent>) => void
  readonly minZoom?: number
  readonly maxZoom?: number
  /** + / − and the buttons (default 0.5). */
  readonly step?: number
  /** A double click toggles fit and this (default 2). */
  readonly doubleClickZoom?: number
  /** A plain wheel scrolls the page (default) or zooms; ctrl-wheel and pinch always zoom. */
  readonly wheel?: "page" | "zoom"
  readonly messages?: MessageOverrides<ImageViewerMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<ImageViewerRenderState>
}

function Root({
  zoom,
  defaultZoom,
  onZoomChange,
  minZoom,
  maxZoom,
  step,
  doubleClickZoom,
  wheel = "page",
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: ImageViewerRootProps) {
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("image-viewer", imageViewerMessages, ownMessages)
  const [label, setLabel] = useState("")
  const wheelRef = useRef(wheel)
  wheelRef.current = wheel
  // Stable: the gestures effect depends on it (a new function would re-measure every render).
  const [wheelZooms] = useState(() => () => wheelRef.current === "zoom")
  const machineProps = {
    id: instance,
    zoom,
    defaultZoom,
    onZoomChange,
    minZoom,
    maxZoom,
    step,
    doubleClickZoom,
    messages,
    lang: locale,
  }
  const { view, send } = useMachine(imageViewerMachine, machineProps, env)
  const { context } = view
  const current = view.values.zoom
  const api = imageViewerConnect({
    instance,
    state: view.state as "loading" | "idle" | "panning" | "settling",
    placement: viewerPlacement(context.natural, context.viewport, current, context.offset),
    minZoom: minZoomOf(machineProps),
    maxZoom: maxZoomOf(machineProps),
    label,
    ids: { instructions: partId("image-viewer", instance, "instructions") },
    messages,
    locale,
  })
  const state: ImageViewerRenderState = {
    zoom: current,
    zoomed: current > minZoomOf(machineProps),
    panning: view.state === "panning",
  }
  const rootProps = mergeProps(
    { ...normalizeProps(api.root()), ref, ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <ImageViewerContext
      value={{
        api,
        state,
        send,
        setLabel,
        room: roomOf(current, context),
        viewport: context.viewport,
        wheelZooms,
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
    </ImageViewerContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<ImageViewerRenderState>
}

function Viewport({ render, ref, children, ...rest }: PartProps<"div">) {
  const ctx = useViewer("Viewport")
  const env = useEnvironment()
  const el = useRef<HTMLDivElement | null>(null)
  const { send, wheelZooms } = ctx
  useEffect(() => {
    const viewport = el.current
    if (!viewport) return
    return zoomGestures(viewport, {
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
    })
  }, [send, wheelZooms])
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.viewport({ focused, modality })), {
        onFocus: (e: React.FocusEvent) => {
          if (e.target === e.currentTarget) setFocused(true)
        },
        onBlur: (e: React.FocusEvent) => {
          if (e.target === e.currentTarget) setFocused(false)
        },
        onKeyDown: (e: React.KeyboardEvent) => {
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
            if ((horizontal ? ctx.room.width : ctx.room.height) <= 0) return
            e.preventDefault()
            const share = e.shiftKey ? 0.5 : 0.1
            send({
              type: "PAN.KEY",
              dx: ax * ctx.viewport.width * share,
              dy: ay * ctx.viewport.height * share,
            })
          }
        },
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("div", { ...props, children }, render, ctx.state)
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function Image({ render, ref, onLoad, alt, ...rest }: PartProps<"img">) {
  const ctx = useViewer("Image")
  const el = useRef<HTMLImageElement | null>(null)
  const { send, setLabel } = ctx
  // The alt names the viewport (the image itself is hidden: one name, on the focusable group).
  useIsoLayoutEffect(() => setLabel(alt ?? ""), [alt, setLabel])
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

/** A control button: a no-op while aria-disabled (it keeps its focus at the limit). */
function control(
  name: "ZoomIn" | "ZoomOut" | "Reset",
  propsOf: (api: Api) => PartPropsOf,
  event: ImageViewerEvent,
) {
  return function Control({ render, children, ...rest }: PartProps<"button">) {
    const ctx = useViewer(name)
    const own = propsOf(ctx.api)
    // Text children are the name (a visible "+" named "Zoom in" fails label-in-name); the
    // messages' name is for an icon or nothing.
    const text = typeof children === "string" || typeof children === "number"
    const props = mergeProps(
      joinHandlers(normalizeProps(text ? { ...own, "aria-label": undefined } : own), {
        onClick: () => {
          if (own["aria-disabled"] !== "true") ctx.send(event)
        },
      }),
      rest,
    )
    return renderPart("button", { ...props, children }, render, ctx.state)
  }
}

function ZoomText({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useViewer("ZoomText")
  return renderPart(
    "span",
    {
      ...mergeProps(normalizeProps(ctx.api.zoomTextPart()), rest),
      children: children ?? ctx.api.zoomText,
    },
    render,
    ctx.state,
  )
}

export const ImageViewer = {
  Root,
  Viewport,
  Image,
  ZoomIn: control("ZoomIn", (api) => api.zoomIn(), {
    type: "ZOOM.STEP",
    direction: 1,
    source: "button",
  }),
  ZoomOut: control("ZoomOut", (api) => api.zoomOut(), {
    type: "ZOOM.STEP",
    direction: -1,
    source: "button",
  }),
  Reset: control("Reset", (api) => api.reset(), { type: "RESET", source: "button" }),
  ZoomText,
}
