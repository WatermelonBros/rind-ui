import {
  checkImageAltGiven,
  checkImgCount,
  type ImageStatus,
  type ImageStatusProps,
  imageConnect,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  provide,
  type SlotsType,
  type VNodeChild,
} from "vue"
import { type ImageHost, useImageStatusRoot, useStatusImage } from "../image-status"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

export interface ImageState {
  readonly status: ImageStatus
}

interface Ctx {
  readonly api: () => ReturnType<typeof imageConnect>
  readonly host: ImageHost
  readonly state: () => ImageState
  readonly fallback: () => boolean
}
const ImageKey: InjectionKey<Ctx> = Symbol("rind-ui.image")
function useImage(part: string): Ctx {
  const ctx = inject(ImageKey, null)
  if (!ctx) throw new Error(`Image.${part} must be inside Image.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: ImageState) => VNodeChild }>

const Root = defineComponent({
  name: "ImageRoot",
  inheritAttrs: false,
  props: {
    /**
     * Required: the text alternative, or `""` for a decorative image. It names the `<img>`
     * while the image loads and Root when there is no image to show.
     */
    alt: { type: String, required: true },
    /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
    fallbackDelay: Number,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Every status change (observed, not controlled). */
    statusChange: (..._args: Parameters<NonNullable<ImageStatusProps["onStatusChange"]>>) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const { status, fallback, host } = useImageStatusRoot(
      () => ({
        fallbackDelay: props.fallbackDelay,
        onStatusChange: (...args) => emit("statusChange", ...args),
      }),
      () => checkImageAltGiven(props.alt, instance()),
    )
    // `alt` is required; untyped callers can still omit it.
    const api = computed(() =>
      imageConnect({
        instance: instance(),
        status: status.value,
        alt: typeof props.alt === "string" ? props.alt : undefined,
      }),
    )
    provide(ImageKey, {
      api: () => api.value,
      host,
      state: () => ({ status: status.value }),
      fallback: () => fallback.value,
    })
    return () =>
      renderPart(
        "span",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.({ status: status.value }),
        props.asChild,
      )
  },
})

/** The `<img>` (its `alt` is Root's). */
const Img = defineComponent({
  name: "ImageImg",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useImage("Img")
    const image = useStatusImage(
      ctx.host,
      (has) => normalizeProps(ctx.api().img(has)),
      attrs,
      checkImgCount,
    )
    return () => renderPart("img", image(), slots.default?.(ctx.state()), props.asChild)
  },
})

const Fallback = defineComponent({
  name: "ImageFallback",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useImage("Fallback")
    return () =>
      ctx.fallback()
        ? renderPart(
            "span",
            mergeProps(normalizeProps(ctx.api().fallback()), attrs),
            slots.default?.(ctx.state()),
            props.asChild,
          )
        : null
  },
})

/** The parts, by name: `image.parts.ts` re-exports them as the `Image` namespace. */
export { Fallback, Img, Root }
