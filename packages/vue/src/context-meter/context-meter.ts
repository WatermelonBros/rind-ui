// Context Meter (add-context-meter): the attributes come from the props (connect is pure); the
// machine only announces a rising threshold crossing, once, and re-arms on `resetKey`.
import {
  announcerCapability,
  type ContextMeterLevel,
  type ContextMeterMessages,
  type ContextMeterState,
  contextMeterConnect,
  contextMeterMachine,
  contextMeterMessages,
  type MessageOverrides,
  type PartProps,
  partId,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  type PropType,
  provide,
  type SlotsType,
  type VNodeChild,
} from "vue"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "context-meter": ContextMeterMessages
  }
}

/** What every part's default slot receives. */
export interface ContextMeterRenderState {
  readonly state: ContextMeterState
  /** 0–100, one decimal. */
  readonly percent: number
  /** The value in words ("17K of 100K tokens, 17%"). */
  readonly valueText: string
}

interface Ctx {
  readonly api: () => ReturnType<typeof contextMeterConnect>
  readonly state: () => ContextMeterRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: () => string
}
const ContextMeterKey: InjectionKey<Ctx> = Symbol("rind-ui.context-meter")
function useContextMeter(part: string): Ctx {
  const ctx = inject(ContextMeterKey, null)
  if (!ctx) throw new Error(`ContextMeter.${part} must be inside ContextMeter.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: ContextMeterRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "ContextMeterRoot",
  inheritAttrs: false,
  props: {
    /** Tokens used. */
    used: { type: Number, required: true },
    /** The window size; null when unknown (text, no meter role). */
    max: { type: [Number, null] as PropType<number | null>, required: true },
    /** The warning threshold (fraction). Default 0.75. */
    warnAt: Number,
    /** The full threshold (fraction). Default 0.95. */
    fullAt: Number,
    /** Announce a rising threshold crossing, once. Default "polite". */
    announce: String as PropType<"off" | "polite">,
    /** A new value (a new thread) re-arms the thresholds. */
    resetKey: String,
    /** How the numbers are written. Default: compact notation. */
    formatOptions: Object as PropType<Intl.NumberFormatOptions>,
    messages: Object as PropType<MessageOverrides<ContextMeterMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** A rising crossing (compact the thread here). */
    threshold: (_level: ContextMeterLevel) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("context-meter", contextMeterMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const registry = usePartRegistry<"label">({ scope: "context-meter", root: instance() })
    const labelId = () => partId("context-meter", instance(), "label")
    const rendered = useRenderedId(registry, "label")
    useMachine(
      contextMeterMachine,
      () => ({
        used: props.used,
        max: props.max,
        warnAt: props.warnAt,
        fullAt: props.fullAt,
        announce: props.announce,
        resetKey: props.resetKey,
        onThreshold: (l: ContextMeterLevel) => emit("threshold", l),
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      env,
    )
    const api = computed(() =>
      contextMeterConnect({
        instance: instance(),
        used: props.used,
        max: props.max,
        warnAt: props.warnAt,
        fullAt: props.fullAt,
        locale: locale.value.locale,
        formatOptions: props.formatOptions,
        messages: messages.value,
        ids: { label: rendered.value ?? labelId() },
        rendered: { label: rendered.value !== undefined },
      }),
    )
    const state = (): ContextMeterRenderState => ({
      state: api.value.state,
      percent: api.value.percent,
      valueText: api.value.valueText,
    })
    provide(ContextMeterKey, { api: () => api.value, state, registry, labelId })
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(api.value.root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** A part rendering `tag` with the connect props `own(ctx)`, and the state in its slot. */
function part(name: string, tag: string, own: (ctx: Ctx) => PartProps) {
  return defineComponent({
    name: `ContextMeter${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useContextMeter(name)
      return () =>
        renderPart(
          tag,
          mergeProps(normalizeProps(own(ctx)), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

/** Names the meter. */
const Label = defineComponent({
  name: "ContextMeterLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useContextMeter("Label")
    const own = () => props.id ?? ctx.labelId()
    useRegisterPart(ctx.registry, "label", own)
    return () =>
      renderPart(
        "span",
        mergeProps({ ...normalizeProps(ctx.api().label()), id: own() }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The short visible value ("17%"); `aria-hidden` (the meter says it in full). */
const ValueText = defineComponent({
  name: "ContextMeterValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useContextMeter("ValueText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().valueTextPart()), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().shortText,
        props.asChild,
      )
  },
})

/** `aria-hidden`; holds the Indicator. */
const Track = part("Track", "div", (ctx) => ctx.api().track())
/** `aria-hidden`; sized by `--rind-context-meter-percent`. */
const Indicator = part("Indicator", "div", (ctx) => ctx.api().indicator())
/** Where the tokens went: a `dl` of BreakdownItems. */
const Breakdown = part("Breakdown", "dl", (ctx) => ctx.api().breakdown())

/** One `dt`/`dd` pair (`item-key`, `label`, `amount`); the default slot replaces the pair. */
const BreakdownItem = defineComponent({
  name: "ContextMeterBreakdownItem",
  inheritAttrs: false,
  props: {
    /** Identifies the row (`data-key`); `key` is Vue's own. */
    itemKey: { type: String, required: true },
    /** The `dt`: what the tokens went to ("System prompt"). */
    label: String,
    /** The `dd`: how many ("2.1K tokens"). */
    amount: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useContextMeter("BreakdownItem")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().breakdownItem(props.itemKey)), attrs),
        slots.default?.(ctx.state()) ?? [h("dt", props.label), h("dd", props.amount)],
        props.asChild,
      )
  },
})

/** The parts, by name: `context-meter.parts.ts` re-exports them as the `ContextMeter` namespace. */
export { Breakdown, BreakdownItem, Indicator, Label, Root, Track, ValueText }
