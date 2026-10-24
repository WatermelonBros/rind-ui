// Image Cropper parts: wiring only. The machine owns the crop, zoom, rotation and flip, connect
// every attribute; core's crop gestures read the pointer, wheel and pinch on the viewport.
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
    "image-cropper": ImageCropperMessages
  }
}

/** What every part's slot receives. */
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
  readonly api: () => Api
  readonly state: () => ImageCropperRenderState
  readonly send: (event: ImageCropperEvent) => void
  readonly steps: () => { readonly base: number; readonly shift: number; readonly ctrl: number }
}
const CropperKey: InjectionKey<Ctx> = Symbol("rind-ui.image-cropper")
function useCropper(part: string): Ctx {
  const ctx = inject(CropperKey, null)
  if (!ctx) throw new Error(`ImageCropper.${part} must be inside ImageCropper.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: ImageCropperRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "ImageCropperRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    id: String,
    /** Controlled crop (`v-model:crop`), viewport px. */
    crop: { type: Object as PropType<Rect>, default: undefined },
    defaultCrop: Object as PropType<Rect>,
    /** Controlled zoom (`v-model:zoom`). */
    zoom: { type: Number, default: undefined },
    defaultZoom: Number,
    /** Degrees, any angle (`v-model:rotation`). */
    rotation: { type: Number, default: undefined },
    defaultRotation: Number,
    /** `v-model:flip`. */
    flip: { type: Object as PropType<Flip>, default: undefined },
    defaultFlip: Object as PropType<Flip>,
    /** Smallest zoom (default 1). */
    minZoom: Number,
    /** Largest zoom (default 5). */
    maxZoom: Number,
    /** Per wheel notch and per + / − (default 0.1). */
    zoomStep: Number,
    /** Pinch responsiveness (default 2). */
    zoomSensitivity: Number,
    /** Width / height; free when omitted. */
    aspectRatio: Number,
    /** A circle implies aspect 1. */
    cropShape: { type: String as PropType<"rectangle" | "circle">, default: "rectangle" },
    /** Viewport px (default 40). */
    minWidth: Number,
    /** Viewport px (default 40). */
    minHeight: Number,
    /** Viewport px (default Infinity). */
    maxWidth: Number,
    /** Viewport px (default Infinity). */
    maxHeight: Number,
    /** The crop stays; drags and arrows pan the image. */
    fixedCropArea: Boolean,
    /** Arrow step, px (default 1). */
    nudgeStep: { type: Number, default: 1 },
    /** Shift+arrow step, px (default 10). */
    nudgeStepShift: { type: Number, default: 10 },
    /** Ctrl/Cmd+arrow step, px (default 50). */
    nudgeStepCtrl: { type: Number, default: 50 },
    messages: Object as PropType<MessageOverrides<ImageCropperMessages>>,
    /** Default: the provider's locale. */
    locale: String,
  },
  emits: {
    /** `details.data`: the crop in natural pixels (`rect`, `corners`). */
    cropChange: (_crop: Rect, _details: ImageCropperChangeDetails) => true,
    "update:crop": (_crop: Rect) => true,
    zoomChange: (_zoom: number, _details: ImageCropperChangeDetails) => true,
    "update:zoom": (_zoom: number) => true,
    rotationChange: (_rotation: number, _details: ImageCropperChangeDetails) => true,
    "update:rotation": (_rotation: number) => true,
    flipChange: (_flip: Flip, _details: ImageCropperChangeDetails) => true,
    "update:flip": (_flip: Flip) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const loc = useLocale(() => props.locale)
    const messages = useMessages("image-cropper", imageCropperMessages, () => props.messages)
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
      <V>(name: "crop" | "zoom" | "rotation" | "flip") =>
      (value: V, details: ChangeDetails<ImageCropperEvent>) => {
        const d = { ...details, data: latestData }
        // Sound: each emit pair takes this value's type.
        ;(emit as (e: string, ...a: unknown[]) => void)(`${name}Change`, value, d)
        ;(emit as (e: string, ...a: unknown[]) => void)(`update:${name}`, value)
      }
    const machineProps = () => ({
      id: instance(),
      crop: props.crop,
      defaultCrop: props.defaultCrop,
      onCropChange: withData<Rect>("crop"),
      zoom: props.zoom,
      defaultZoom: props.defaultZoom,
      onZoomChange: withData<number>("zoom"),
      rotation: props.rotation,
      defaultRotation: props.defaultRotation,
      onRotationChange: withData<number>("rotation"),
      flip: props.flip,
      defaultFlip: props.defaultFlip,
      onFlipChange: withData<Flip>("flip"),
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      zoomStep: props.zoomStep,
      zoomSensitivity: props.zoomSensitivity,
      aspectRatio: props.aspectRatio,
      cropShape: props.cropShape,
      minWidth: props.minWidth,
      minHeight: props.minHeight,
      maxWidth: props.maxWidth,
      maxHeight: props.maxHeight,
      fixedCropArea: props.fixedCropArea,
      messages: messages.value,
      lang: loc.value.locale,
    })
    const { view, send } = useMachine(imageCropperMachine, machineProps, machineEnv)
    const placement = () => cropPlacementOf(view.value.values, view.value.context)
    const ready = () => view.value.state !== "loading"
    const api = computed(() => {
      const v = view.value
      return imageCropperConnect({
        instance: instance(),
        state: v.state as "loading" | "idle" | "dragging" | "settling",
        placement: placement(),
        crop: v.values.crop,
        shape: props.cropShape,
        fixed: props.fixedCropArea,
        dragging: v.state === "dragging" && v.context.drag?.target !== "image",
        panning: v.state === "dragging" && v.context.drag?.target === "image",
        ready: ready(),
        ids: { instructions: partId("image-cropper", instance(), "instructions") },
        messages: messages.value,
        locale: loc.value.locale,
      })
    })
    const state = (): ImageCropperRenderState => ({
      data: ready() ? cropData(placement(), view.value.values.crop) : null,
      zoom: view.value.values.zoom,
      rotation: view.value.values.rotation,
      flip: view.value.values.flip,
      dragging: view.value.state === "dragging",
    })
    provide(CropperKey, {
      api: () => api.value,
      state,
      send,
      steps: () => ({
        base: props.nudgeStep,
        shift: props.nudgeStepShift,
        ctrl: props.nudgeStepCtrl,
      }),
    })
    return () => {
      const a = api.value
      const { children: _text, ...instructions } = normalizeProps(a.instructions())
      void _text
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

const Viewport = defineComponent({
  name: "ImageCropperViewport",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCropper("Viewport")
    const el = shallowRef<Element | null>(null)
    onMounted(() =>
      watch(
        el,
        (viewport, _, onCleanup) => {
          if (!(viewport instanceof HTMLElement)) return
          onCleanup(
            cropGestures(viewport, {
              onSize: (s) => ctx.send({ type: "VIEWPORT.MEASURED", ...s }),
              onDragStart: (target, x, y) => ctx.send({ type: "DRAG.START", target, x, y }),
              onDragMove: (x, y, lockRatio) => ctx.send({ type: "DRAG.MOVE", x, y, lockRatio }),
              onDragEnd: () => ctx.send({ type: "DRAG.END" }),
              onWheel: (direction, at) => ctx.send({ type: "ZOOM.STEP", direction, at }),
              onPinchStart: (distance) => ctx.send({ type: "PINCH.START", distance }),
              onPinchMove: (distance, center) => ctx.send({ type: "PINCH.MOVE", distance, center }),
              onPinchEnd: () => ctx.send({ type: "PINCH.END" }),
            }),
          )
        },
        { immediate: true },
      ),
    )
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().viewport()), ref: refTo(el) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Image = defineComponent({
  name: "ImageCropperImage",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useCropper("Image")
    const el = shallowRef<Element | null>(null)
    // An image already decoded before hydration fires no load event.
    onMounted(() => {
      const img = el.value as HTMLImageElement | null
      if (img?.complete && img.naturalWidth > 0) {
        ctx.send({ type: "IMAGE.LOADED", width: img.naturalWidth, height: img.naturalHeight })
      }
    })
    return () =>
      renderPart(
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
          attrs,
        ),
        undefined,
        props.asChild,
      )
  },
})

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

const Selection = defineComponent({
  name: "ImageCropperSelection",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCropper("Selection")
    const env = useEnvironment()
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(
            normalizeProps(
              ctx.api().selection({ focused: focused.value, modality: modality.value }),
            ),
            {
              onFocus: () => (focused.value = true),
              onBlur: () => (focused.value = false),
              onKeydown: (e: KeyboardEvent) => {
                const arrow = ARROWS[e.key]
                if (arrow) {
                  e.preventDefault()
                  // Modifiers from the event itself (never a remembered keys-down set).
                  const steps = ctx.steps()
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
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Handle = defineComponent({
  name: "ImageCropperHandle",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The edge or corner it resizes: n, s, e, w, ne, nw, se or sw. */
    position: { type: String as PropType<HandlePosition>, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCropper("Handle")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().handle(props.position)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Grid = defineComponent({
  name: "ImageCropperGrid",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** Which thirds lines it draws. */
    axis: { type: String as PropType<"horizontal" | "vertical">, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCropper("Grid")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().grid(props.axis)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The parts, by name: `image-cropper.parts.ts` re-exports them as the `ImageCropper` namespace. */
export { Grid, Handle, Image, Root, Selection, Viewport }
