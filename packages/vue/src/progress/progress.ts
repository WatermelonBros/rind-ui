import {
  announcerCapability,
  checkRangeName,
  type MessageOverrides,
  type PartProps,
  type ProgressMessages,
  type ProgressState,
  partId,
  progressConnect,
  progressMachine,
  progressMessages,
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
    progress: ProgressMessages
  }
}

/** What every part's default slot receives. */
export interface ProgressRenderState {
  readonly state: ProgressState
  /** The clamped value; `null` when indeterminate. */
  readonly value: number | null
  readonly percent: number
  readonly valueText: string | undefined
}

interface Ctx {
  readonly api: () => ReturnType<typeof progressConnect>
  readonly registry: PartRegistry<"label">
  readonly instance: () => string
  readonly state: () => ProgressRenderState
}
const ProgressKey: InjectionKey<Ctx> = Symbol("rind-ui.progress")
function useProgress(part: string): Ctx {
  const ctx = inject(ProgressKey, null)
  if (!ctx) throw new Error(`Progress.${part} must be inside Progress.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: ProgressRenderState) => VNodeChild }>

const Root = defineComponent({
  name: "ProgressRoot",
  inheritAttrs: false,
  props: {
    /** `null` / `undefined` (the default): indeterminate. 0 is a value. */
    value: { type: Number as PropType<number | null>, default: null },
    min: Number,
    max: Number,
    orientation: { type: String as PropType<RangeOrientation>, default: "horizontal" },
    /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
    formatOptions: Object as PropType<Intl.NumberFormatOptions>,
    /** Default: the provider's locale. */
    locale: String,
    /** Announce `messages.complete` when the value reaches `max`. Never on mount. */
    announceCompletion: { type: Boolean, default: undefined },
    messages: Object as PropType<MessageOverrides<ProgressMessages>>,
    id: String,
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability)
    const messages = useMessages("progress", progressMessages, () => props.messages)
    const locale = useLocale(() => props.locale)
    const consumerNamed = () =>
      attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
    // A consumer name replaces the Label: then the Label is not expected on the server.
    const registry = usePartRegistry<"label">(
      consumerNamed()
        ? { scope: "progress", root: instance() }
        : { scope: "progress", root: instance(), expected: ["label"] },
    )
    useMachine(
      progressMachine,
      () => ({
        value: props.value,
        min: props.min,
        max: props.max,
        announceCompletion: props.announceCompletion,
        messages: messages.value,
        id: instance(),
        lang: locale.value.locale,
      }),
      env,
    )
    const labelledBy = useRenderedId(registry, "label")
    const derived = computed(() => {
      const range = resolveRangeValue(
        { value: props.value, min: props.min, max: props.max },
        "progress",
      )
      const text = rangeValueText(
        range,
        { locale: locale.value.locale, formatOptions: props.formatOptions },
        messages.value.valueText,
      )
      const api = progressConnect({
        instance: instance(),
        range,
        text,
        orientation: props.orientation,
        labelledBy: consumerNamed() ? undefined : labelledBy.value,
      })
      const state: ProgressRenderState = {
        state: api.state,
        value: range.value,
        percent: range.percent,
        valueText: text,
      }
      return { api, state }
    })
    onMounted(() =>
      // After mount, once per change of what it reads (the Label registers on its mount).
      watch(
        () => [labelledBy.value !== undefined, consumerNamed(), attrs["aria-hidden"]] as const,
        ([hasLabel, named]) => checkRangeName("progress", attrs, hasLabel || named),
        { immediate: true },
      ),
    )
    provide(ProgressKey, {
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
    name: `Progress${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = useProgress(name)
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
  name: "ProgressLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useProgress("Label")
    const labelId = () => props.id ?? partId("progress", ctx.instance(), "label")
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
  name: "ProgressValueText",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useProgress("ValueText")
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
/** The fill, sized by `--rind-progress-percent`. */
const Indicator = part("Indicator", "div", (ctx) => ctx.api().indicator())
/** The ring's `svg` (`aria-hidden`); holds CircleTrack and CircleIndicator. */
const Circle = part("Circle", "svg", (ctx) => ctx.api().circle())
const CircleTrack = part("CircleTrack", "circle", (ctx) => ctx.api().circleTrack())
/** The ring's arc: `stroke-dashoffset` = 100 − percent on a `pathLength` of 100. */
const CircleIndicator = part("CircleIndicator", "circle", (ctx) => ctx.api().circleIndicator())

/** The parts, by name: `progress.parts.ts` re-exports them as the `Progress` namespace. */
export { Circle, CircleIndicator, CircleTrack, Indicator, Label, Root, Track, ValueText }
