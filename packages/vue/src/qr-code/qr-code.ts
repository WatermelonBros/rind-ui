import {
  blobToDataUrl,
  createQrEncoder,
  exportQr,
  type MessageOverrides,
  partId,
  type QrCodeMessages,
  type QrDownloadDetails,
  type QrDownloadOptions,
  type QrEncodeFailure,
  type QrEncodingOptions,
  type QrMime,
  qrCodeConnect,
  qrCodeIds,
  qrCodeMachine,
  qrCodeMessages,
  qrEncodingKey,
  warnEncodeError,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
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
import { Button } from "../button/button"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { declaredItems } from "../use-collection-items"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "qr-code": QrCodeMessages
  }
}

export interface QrCodeState {
  /** `ready`: a symbol; `empty`: no value; `invalid`: the encoder failed. */
  readonly state: "ready" | "empty" | "invalid"
  readonly downloading: boolean
}

/** The Root's imperative API (a template ref on it). */
export interface QrCodeApi {
  /** The symbol as a `data:` URL (PNG by default), overlay composited like a download. */
  readonly getDataUrl: (
    mimeType?: QrMime,
    options?: Omit<QrDownloadOptions, "mimeType" | "fileName">,
  ) => Promise<string>
  /** Starts a download, as pressing the trigger does (ignored while one runs). */
  readonly download: (options?: QrDownloadOptions) => void
  /** Proposes a new value (only `valueChange` when controlled). */
  readonly setValue: (value: string) => void
}

type Modality = "pointer" | "keyboard" | "touch" | "virtual"
interface Ctx {
  readonly connect: () => ReturnType<typeof qrCodeConnect>
  readonly registry: PartRegistry<"value-text">
  /** Before mount: a ValueText declared in the Root's slot (the server HTML references it). */
  readonly declaredValueText: () => string | undefined
  readonly value: () => string
  readonly state: () => QrCodeState
  readonly download: (options: QrDownloadOptions & { readonly modality: Modality }) => void
  readonly report: (part: "valueText" | "overlay", mounted: boolean) => void
}
const QrCodeKey: InjectionKey<Ctx> = Symbol("rind-ui.qr-code")
function useQrCode(part: string): Ctx {
  const ctx = inject(QrCodeKey, null)
  if (!ctx) throw new Error(`QrCode.${part} must be inside QrCode.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: QrCodeState) => VNodeChild }>

const Root = defineComponent({
  name: "QrCodeRoot",
  inheritAttrs: false,
  props: {
    /** Controlled value (`v-model`). */
    modelValue: String,
    /** Default `""` (an empty frame). */
    defaultValue: String,
    /** Encoder options and the quiet zone, compared by value (an inline object is fine). */
    encoding: Object as PropType<QrEncodingOptions>,
    messages: Object as PropType<MessageOverrides<QrCodeMessages>>,
    id: String,
    ...asChildProp,
  },
  emits: {
    valueChange: (_value: string) => true,
    "update:modelValue": (_value: string) => true,
    /** The encoder failed (too long, invalid option): once per distinct value. */
    encodeError: (_error: QrEncodeFailure) => true,
    download: (_details: QrDownloadDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit, expose }) {
    const instance = useRootId(() => props.id)
    const messages = useMessages("qr-code", qrCodeMessages, () => props.messages)
    const encoder = createQrEncoder()
    // Stable: reads the latest options; the encoder memoises by value and option values.
    const encode = (v: string) => encoder.encode(v, props.encoding)
    const { view, send } = useMachine(qrCodeMachine, () => ({
      value: props.modelValue,
      defaultValue: props.defaultValue,
      onValueChange: (v: string) => {
        emit("valueChange", v)
        emit("update:modelValue", v)
      },
      encode,
      encodingKey: qrEncodingKey("", props.encoding),
      root: instance(),
      onDownload: (d: QrDownloadDetails) => emit("download", d),
    }))
    const current = () => view.value.values.value
    const encoded = computed(() => encode(current()))
    const registry = usePartRegistry<"value-text">({ scope: "qr-code", root: instance() })
    const mounted = shallowRef(false)
    onMounted(() => (mounted.value = true))
    let declared = false
    // Once per distinct failing value (and its options), after mount: never during render.
    let reported: string | undefined
    onMounted(() =>
      watch(
        () =>
          encoded.value.status === "invalid" ? qrEncodingKey(current(), props.encoding) : undefined,
        (key) => {
          if (key === undefined || key === reported) return
          reported = key
          const e = encoded.value
          if (e.status !== "invalid") return
          warnEncodeError(e)
          emit("encodeError", e.error)
        },
        { immediate: true },
      ),
    )
    // Mounted optional parts, reported to the machine (the overlay measurement needs them).
    const parts = { valueText: 0, overlay: 0 }
    const report = (part: "valueText" | "overlay", on: boolean) => {
      parts[part] += on ? 1 : -1
      send({ type: "PARTS.CHANGED", valueText: parts.valueText > 0, overlay: parts.overlay > 0 })
    }
    const state = computed(
      (): QrCodeState => ({
        state: encoded.value.status,
        downloading: view.value.state === "downloading",
      }),
    )
    const connect = computed(() =>
      qrCodeConnect({
        instance: instance(),
        encoded: encoded.value,
        downloading: state.value.downloading,
        covers: view.value.context.coverage?.covers,
        lastDownload: view.value.context.lastDownload?.fileName,
        messages: messages.value,
      }),
    )
    expose({
      getDataUrl: async (mimeType = "image/png", o = {}) => {
        const e = encoded.value
        if (e.status !== "ready") throw new Error("[rind-ui] qr-code: there is no symbol to export")
        const ids = qrCodeIds(instance())
        const byId = (i: string) => document.getElementById(i)
        const { blob } = await exportQr({
          modules: e.result.modules,
          quietZone: e.quietZone,
          mimeType,
          quality: o.quality,
          size: o.size ?? 1024,
          frame: byId(ids.frame),
          pattern: byId(ids.pattern),
          overlay: byId(ids.overlay),
        })
        return blobToDataUrl(blob)
      },
      download: (o = {}) => send({ type: "DOWNLOAD", modality: "virtual", ...o }),
      setValue: (v) => send({ type: "VALUE.SET", value: v }),
    } satisfies QrCodeApi)
    provide(QrCodeKey, {
      connect: () => connect.value,
      registry,
      declaredValueText: () =>
        !mounted.value && declared ? partId("qr-code", instance(), "value-text") : undefined,
      value: current,
      state: () => state.value,
      download: ({ modality, ...o }) => send({ type: "DOWNLOAD", modality, ...o }),
      report,
    })
    return () => {
      const children = slots.default?.(state.value)
      // A ValueText in the slot is known at render, on the server too: only then does the frame
      // reference it before mount. One inside another component registers after mount.
      if (!mounted.value) declared = declaredItems(children, ValueText, true).length > 0
      return renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(connect.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

/** The symbol: an `svg` with the quiet zone in its viewBox, named when there is a symbol. */
const Frame = defineComponent({
  name: "QrCodeFrame",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useQrCode("Frame")
    const rendered = useRenderedId(ctx.registry, "value-text")
    return () => {
      const { "aria-describedby": describedBy, ...own } = attrs
      const named = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      const valueTextId = rendered.value ?? ctx.declaredValueText()
      return renderPart(
        "svg",
        mergeProps(
          normalizeProps(
            ctx.connect().frame({
              named,
              valueTextId,
              ...(describedBy === undefined ? {} : { describedBy: describedBy as string }),
            }),
          ),
          own,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

/** The dark modules: one path of merged runs. */
const Pattern = defineComponent({
  name: "QrCodePattern",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useQrCode("Pattern")
    return () =>
      renderPart(
        "path",
        mergeProps(normalizeProps(ctx.connect().pattern()), attrs),
        undefined,
        props.asChild,
      )
  },
})

/** Centred content over the symbol (a logo); the modules under it stay in the matrix. */
const Overlay = defineComponent({
  name: "QrCodeOverlay",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useQrCode("Overlay")
    onMounted(() => ctx.report("overlay", true))
    onBeforeUnmount(() => ctx.report("overlay", false))
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.connect().overlay()), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/**
 * The value as visually hidden text: the frame's description. Nothing while there is no
 * symbol (empty or invalid): there is no image for it to describe.
 */
const ValueText = defineComponent({
  name: "QrCodeValueText",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useQrCode("ValueText")
    const shown = () => ctx.state().state === "ready"
    const id = () => props.id ?? (ctx.connect().valueText()["id"] as string) // connect always sets the part's id
    useRegisterPart(ctx.registry, "value-text", () => (shown() ? id() : undefined))
    onMounted(() => ctx.report("valueText", true))
    onBeforeUnmount(() => ctx.report("valueText", false))
    return () => {
      if (!shown()) return null
      return renderPart(
        "span",
        mergeProps(
          {
            ...normalizeProps(ctx.connect().valueText()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(ctx.state()) ?? ctx.value(),
        props.asChild,
      )
    }
  },
})

/** Saves the symbol as a file; `aria-disabled` while there is no symbol. */
const DownloadTrigger = defineComponent({
  name: "QrCodeDownloadTrigger",
  inheritAttrs: false,
  props: {
    mimeType: String as PropType<QrMime>,
    quality: Number,
    fileName: String,
    size: Number,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useQrCode("DownloadTrigger")
    return () => {
      const content = slots.default?.(ctx.state())
      const hasContent = content !== undefined && content !== null
      return h(
        Button,
        {
          ...mergeProps(normalizeProps(ctx.connect().downloadTrigger(hasContent)), attrs),
          type: "button",
          disabled: ctx.state().state !== "ready",
          focusableWhenDisabled: true,
          asChild: props.asChild,
          onPress: (d: { modality: Modality }) =>
            ctx.download({
              modality: d.modality,
              ...(props.mimeType === undefined ? {} : { mimeType: props.mimeType }),
              ...(props.quality === undefined ? {} : { quality: props.quality }),
              ...(props.fileName === undefined ? {} : { fileName: props.fileName }),
              ...(props.size === undefined ? {} : { size: props.size }),
            }),
        },
        hasContent ? { default: () => content } : {},
      )
    }
  },
})

/** A value rendered as a scannable QR code symbol, named, described and downloadable. */
/** The parts, by name: `qr-code.parts.ts` re-exports them as the `QrCode` namespace. */
export { DownloadTrigger, Frame, Overlay, Pattern, Root, ValueText }
