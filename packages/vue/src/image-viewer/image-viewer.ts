// Image Viewer parts: wiring only. The machine owns zoom and pan, connect every attribute;
// core's zoom gestures read the pointer, wheel and pinch on the viewport.
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
  computed,
  defineComponent,
  Fragment,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "image-viewer": ImageViewerMessages
  }
}

/** What every part's slot receives. */
export interface ImageViewerRenderState {
  readonly zoom: number
  readonly zoomed: boolean
  readonly panning: boolean
}

type Api = ReturnType<typeof imageViewerConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => ImageViewerRenderState
  readonly send: (event: ImageViewerEvent) => void
  readonly setLabel: (label: string) => void
  /** Pan room on each axis (px), for the arrow keys. */
  readonly room: () => { readonly width: number; readonly height: number }
  readonly viewport: () => { readonly width: number; readonly height: number }
  readonly wheelZooms: () => boolean
}
const ViewerKey: InjectionKey<Ctx> = Symbol("rind-ui.image-viewer")
function useViewer(part: string): Ctx {
  const ctx = inject(ViewerKey, null)
  if (!ctx) throw new Error(`ImageViewer.${part} must be inside ImageViewer.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: ImageViewerRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "ImageViewerRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Controlled zoom (`v-model:zoom`; 1 = the image fitted). */
    zoom: { type: Number, default: undefined },
    defaultZoom: Number,
    minZoom: Number,
    maxZoom: Number,
    /** + / − and the buttons (default 0.5). */
    step: Number,
    /** A double click toggles fit and this (default 2). */
    doubleClickZoom: Number,
    /** A plain wheel scrolls the page (default) or zooms; ctrl-wheel and pinch always zoom. */
    wheel: { type: String as PropType<"page" | "zoom">, default: "page" },
    messages: Object as PropType<MessageOverrides<ImageViewerMessages>>,
    /** Default: the provider's locale. */
    locale: String,
  },
  emits: {
    zoomChange: (_zoom: number, _details: ChangeDetails<ImageViewerEvent>) => true,
    "update:zoom": (_zoom: number) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages("image-viewer", imageViewerMessages, () => props.messages)
    const label = shallowRef("")
    const machineProps = () => ({
      id: instance(),
      zoom: props.zoom,
      defaultZoom: props.defaultZoom,
      onZoomChange: (z: number, d: ChangeDetails<ImageViewerEvent>) => {
        emit("zoomChange", z, d)
        emit("update:zoom", z)
      },
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      step: props.step,
      doubleClickZoom: props.doubleClickZoom,
      messages: messages.value,
      lang: loc.value.locale,
    })
    const { view, send } = useMachine(imageViewerMachine, machineProps, env)
    const api = computed(() => {
      const { context } = view.value
      const current = view.value.values.zoom
      return imageViewerConnect({
        instance: instance(),
        state: view.value.state as "loading" | "idle" | "panning" | "settling",
        placement: viewerPlacement(context.natural, context.viewport, current, context.offset),
        minZoom: minZoomOf(machineProps()),
        maxZoom: maxZoomOf(machineProps()),
        label: label.value,
        ids: { instructions: partId("image-viewer", instance(), "instructions") },
        messages: messages.value,
        locale: loc.value.locale,
      })
    })
    const state = (): ImageViewerRenderState => ({
      zoom: view.value.values.zoom,
      zoomed: view.value.values.zoom > minZoomOf(machineProps()),
      panning: view.value.state === "panning",
    })
    provide(ViewerKey, {
      api: () => api.value,
      state,
      send,
      setLabel: (l) => (label.value = l),
      room: () => roomOf(view.value.values.zoom, view.value.context),
      viewport: () => view.value.context.viewport,
      wheelZooms: () => props.wheel === "zoom",
    })
    return () => {
      const a = api.value
      const { children: text, ...instructions } = normalizeProps(a.instructions())
      void text
      return renderPart(
        "div",
        mergeProps(
          { ...normalizeProps(a.root()), ...(props.id === undefined ? {} : { id: props.id }) },
          attrs,
        ),
        h(Fragment, [slots.default?.(state()), h("span", instructions, a.instructionsText)]),
        props.asChild,
      )
    }
  },
})

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

const Viewport = defineComponent({
  name: "ImageViewerViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useViewer("Viewport")
    const env = useEnvironment()
    const el = shallowRef<Element | null>(null)
    onMounted(() => {
      watch(
        el,
        (viewport, _, onCleanup) => {
          if (!(viewport instanceof HTMLElement)) return
          onCleanup(
            zoomGestures(viewport, {
              onSize: (s) => ctx.send({ type: "VIEWPORT.MEASURED", ...s }),
              onDragStart: (x, y) => ctx.send({ type: "DRAG.START", x, y }),
              onDragMove: (x, y) => ctx.send({ type: "DRAG.MOVE", x, y }),
              onDragEnd: () => ctx.send({ type: "DRAG.END" }),
              onZoomBy: (factor, at) => ctx.send({ type: "ZOOM.BY", factor, at }),
              onPinchStart: (distance) => ctx.send({ type: "PINCH.START", distance }),
              onPinchMove: (distance, center) => ctx.send({ type: "PINCH.MOVE", distance, center }),
              onPinchEnd: () => ctx.send({ type: "PINCH.END" }),
              onToggle: (at) => ctx.send({ type: "TOGGLE", at }),
              wheelZooms: ctx.wheelZooms,
            }),
          )
        },
        { immediate: true },
      )
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(
                ctx.api().viewport({ focused: focused.value, modality: modality.value }),
              ),
              {
                onFocus: (e: FocusEvent) => {
                  if (e.target === e.currentTarget) focused.value = true
                },
                onBlur: (e: FocusEvent) => {
                  if (e.target === e.currentTarget) focused.value = false
                },
                onKeydown: (e: KeyboardEvent) => {
                  if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
                  if (e.key === "+" || e.key === "=") {
                    e.preventDefault()
                    ctx.send({ type: "ZOOM.STEP", direction: 1, source: "key" })
                  } else if (e.key === "-" || e.key === "_") {
                    e.preventDefault()
                    ctx.send({ type: "ZOOM.STEP", direction: -1, source: "key" })
                  } else if (e.key === "0") {
                    e.preventDefault()
                    ctx.send({ type: "RESET", source: "key" })
                  } else {
                    const arrow = ARROWS[e.key]
                    if (!arrow) return
                    const [ax, ay] = arrow
                    const horizontal = ax !== 0
                    const room = ctx.room()
                    // Nothing to pan on this axis: the page scrolls.
                    if ((horizontal ? room.width : room.height) <= 0) return
                    e.preventDefault()
                    const share = e.shiftKey ? 0.5 : 0.1
                    const vp = ctx.viewport()
                    ctx.send({
                      type: "PAN.KEY",
                      dx: ax * vp.width * share,
                      dy: ay * vp.height * share,
                    })
                  }
                },
              },
            ),
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Image = defineComponent({
  name: "ImageViewerImage",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useViewer("Image")
    const el = shallowRef<Element | null>(null)
    // The alt names the viewport (the image itself is hidden: one name, on the focusable group).
    watch(
      () => attrs["alt"] as string | undefined,
      (alt) => ctx.setLabel(alt ?? ""),
      { immediate: true },
    )
    // An image already decoded before hydration fires no load event.
    onMounted(() => {
      const img = el.value as HTMLImageElement | null
      if (img?.complete && img.naturalWidth > 0) {
        ctx.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
      }
    })
    return () => {
      const { alt: _alt, ...rest } = attrs
      void _alt
      return renderPart(
        "img",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().image()), {
              onLoad: (e: Event) => {
                const img = e.currentTarget as HTMLImageElement
                ctx.send({
                  type: "IMAGE.LOADED",
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                })
              },
            }),
            ref: refTo(el),
          },
          rest,
        ),
        undefined,
        props.asChild,
      )
    }
  },
})

/** A control button: a no-op while aria-disabled (it keeps its focus at the limit). */
function control(
  name: "ZoomIn" | "ZoomOut" | "Reset",
  propsOf: (api: Api) => ReturnType<Api["zoomIn"]>,
  event: ImageViewerEvent,
) {
  return defineComponent({
    name: `ImageViewer${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useViewer(name)
      return () => {
        const own = propsOf(ctx.api())
        const children = slots.default?.(ctx.state())
        // Text children are the name (a visible "+" named "Zoom in" fails label-in-name); the
        // messages' name is for an icon or nothing.
        const text =
          Array.isArray(children) &&
          children.length > 0 &&
          children.every(
            (c) =>
              typeof c === "object" &&
              c !== null &&
              typeof (c as { type: unknown }).type === "symbol" &&
              typeof (c as { children: unknown }).children === "string",
          )
        return renderPart(
          "button",
          mergeProps(
            joinHandlers(normalizeProps(text ? { ...own, "aria-label": undefined } : own), {
              onClick: () => {
                if (own["aria-disabled"] !== "true") ctx.send(event)
              },
            }),
            attrs,
          ),
          children,
          props.asChild,
        )
      }
    },
  })
}

const ZoomText = defineComponent({
  name: "ImageViewerZoomText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useViewer("ZoomText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().zoomTextPart()), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().zoomText,
        props.asChild,
      )
  },
})

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
