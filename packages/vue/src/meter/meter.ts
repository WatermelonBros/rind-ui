import {
  checkMeterValue,
  checkRangeName,
  type MessageOverrides,
  type MeterMessages,
  type MeterValueTextArgs,
  type MeterZone,
  meterConnect,
  meterMachine,
  meterMessages,
  meterZone,
  type PartProps,
  partId,
  quirkActive,
  type RangeOrientation,
  rangeFillerProps,
  rangeValueText,
  resolveRangeValue,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  type VNodeChild,
  watch,
} from "vue"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    meter: MeterMessages
  }
}

/** What every part's default slot receives. */
export interface MeterRenderState {
  readonly value: number
  readonly percent: number
  readonly zone: MeterZone | undefined
  readonly valueText: string | undefined
}

interface Ctx {
  readonly api: () => ReturnType<typeof meterConnect>
  readonly registry: PartRegistry<"label">
  readonly instance: () => string
  readonly state: () => MeterRenderState
}
const MeterKey: InjectionKey<Ctx> = Symbol("rind-ui.meter")
function useMeter(part: string): Ctx {
  const ctx = inject(MeterKey, null)
  if (!ctx) throw new Error(`Meter.${part} must be inside Meter.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: MeterRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "MeterRoot",
  inheritAttrs: false,
  props: {
    /** Required: a meter is never indeterminate. */
    value: { type: Number, required: true },
    min: Number,
    max: Number,
    /** HTML `<meter>` regions: `low`, `high` and where the `optimum` lies. */
    low: Number,
    high: Number,
    optimum: Number,
    orientation: { type: String as PropType<RangeOrientation>, default: "horizontal" },
    /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
    formatOptions: Object as PropType<Intl.NumberFormatOptions>,
    /** Default: the provider's locale. */
    locale: String,
    messages: Object as PropType<MessageOverrides<MeterMessages>>,
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment()
    const messages = useMessages("meter", meterMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const consumerNamed = () =>
      attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
    // A consumer name replaces the Label: then the Label is not expected on the server.
    const registry = usePartRegistry<"label">(
      consumerNamed()
        ? { scope: "meter", root: instance() }
        : { scope: "meter", root: instance(), expected: ["label"] },
    )
    useMachine(meterMachine, () => ({
      value: props.value,
      min: props.min,
      max: props.max,
      low: props.low,
      high: props.high,
      optimum: props.optimum,
    }))
    const labelledBy = useRenderedId(registry, "label")
    const derived = computed(() => {
      const resolved = resolveRangeValue(
        { value: props.value, min: props.min, max: props.max },
        "meter",
      )
      // A missing value renders as min (development error below): never indeterminate.
      const range = resolved.value === null ? { ...resolved, value: resolved.min } : resolved
      const zone = meterZone(range, { low: props.low, high: props.high, optimum: props.optimum })
      const text = rangeValueText<MeterValueTextArgs>(
        range,
        { locale: locale.value.locale, formatOptions: props.formatOptions },
        messages.value.valueText,
        { zone },
      )
      const api = meterConnect({
        instance: instance(),
        range,
        zone,
        text,
        orientation: props.orientation,
        labelledBy: consumerNamed() ? undefined : labelledBy.value,
      })
      const state: MeterRenderState = {
        value: range.value ?? range.min,
        percent: range.percent,
        zone,
        valueText: text,
      }
      return { api, state }
    })
    onMounted(() => {
      // After mount, once per change of what they read (the Label registers on its mount).
      watch(
        () => [labelledBy.value !== undefined, consumerNamed(), attrs["aria-hidden"]] as const,
        ([hasLabel, named]) => checkRangeName("meter", attrs, hasLabel || named),
        { immediate: true },
      )
      watch(() => props.value, checkMeterValue, { immediate: true })
    })
    provide(MeterKey, {
      api: () => derived.value.api,
      registry,
      instance,
      state: () => derived.value.state,
    })
    return () => {
      const { api, state } = derived.value
      const filler = quirkActive("nvda-progressbar-name", env)
        ? renderPart("span", normalizeProps(rangeFillerProps), undefined)
        : null
      const merged = mergeProps(
        { ...normalizeProps(api.root()), ...(props.id === undefined ? {} : { id: props.id }) },
        attrs,
      )
      return renderPart("div", merged, [slots.default?.(state), filler], props.asChild)
    }
  },
})

/** A part rendering `tag` with the connect props `own(ctx)`, and the state in its slot. */
function part(name: string, tag: string, own: (ctx: Ctx) => PartProps) {
  return defineComponent({
    name: `Meter${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useMeter(name)
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

/** The name: Root is `aria-labelledby` it while it is rendered. */
const Label = defineComponent({
  name: "MeterLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useMeter("Label")
    const labelId = () => props.id ?? partId("meter", ctx.instance(), "label")
    useRegisterPart(ctx.registry, "label", labelId)
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().label(labelId())), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The visible value text, `aria-hidden` (Root carries it as `aria-valuetext`). */
const ValueText = defineComponent({
  name: "MeterValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useMeter("ValueText")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().valueText()), attrs),
        slots.default?.(ctx.state()) ?? ctx.state().valueText,
        props.asChild,
      )
  },
})

const Track = part("Track", "div", (ctx) => ctx.api().track())
/** The fill, sized by `--rind-meter-percent`. */
const Indicator = part("Indicator", "div", (ctx) => ctx.api().indicator())

/** The parts, by name: `meter.parts.ts` re-exports them as the `Meter` namespace. */
export { Indicator, Label, Root, Track, ValueText }
