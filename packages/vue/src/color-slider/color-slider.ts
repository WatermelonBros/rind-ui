// Color Slider parts (design §5): a Slider bound to one channel of a colour. The colour value
// (Echo rule, hue memory, commits) is the shared colour-value machine; every Slider part is
// rendered as it is, with the binding's props and appearance.
import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorNameProp,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  getChannel,
  type MessageOverrides,
  makeColor,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  type ColorSliderMessages,
  channelSliderNaming,
  colorSliderConnect,
  colorSliderMessages,
  colorSliderSpace,
  colorVariables,
} from "@rind-ui/core/internal"
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
  shallowRef,
} from "vue"
import { colorProp, useColorProp } from "../color-input"
import { TransparencyGrid as Grid } from "../color-swatch/color-swatch"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { SliderNamingKey, SliderRootSurfaceKey, type SliderValue } from "../slider/slider"
import * as Slider from "../slider/slider.parts"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "color-slider": ColorSliderMessages
  }
}

type Style = Record<string, unknown>
const style = (s: object) => (normalizeProps({ style: s }) as { style?: Style }).style ?? {}

interface Ctx {
  readonly data: () => Readonly<Record<`data-${string}`, string>>
  readonly trackStyle: () => Style
  readonly thumbStyle: () => Style
  readonly setLabelled: (on: boolean) => void
}
const ColorSliderKey: InjectionKey<Ctx> = Symbol("rind-ui.color-slider")
function useColorSlider(part: string): Ctx {
  const ctx = inject(ColorSliderKey, null)
  if (!ctx) throw new Error(`ColorSlider.${part} must be inside ColorSlider.Root`)
  return ctx
}

const DEFAULT = makeColor("hsb", [0, 100, 100])

/** One channel of a colour edited with a Slider whose track is the channel's gradient. */
const Root = defineComponent({
  name: "ColorSliderRoot",
  inheritAttrs: false,
  props: {
    /** The edited channel: red, green, blue, hue, saturation, lightness, brightness or alpha. */
    channel: { type: String as PropType<ColorChannel>, required: true },
    /** The colour (`v-model`). */
    modelValue: colorProp,
    /** Default `hsb(0, 100%, 100%)`. */
    defaultValue: colorProp,
    /** The working space. Default: the colour's when it has the channel. */
    colorSpace: String as PropType<ColorSpace>,
    /** Replaces the colour name in the value text. */
    colorName: [String, Function] as PropType<ColorNameProp>,
    /** Channel names, value text and colour words. */
    messages: Object as PropType<MessageOverrides<ColorSliderMessages>>,
    orientation: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
    locale: String,
    dir: String as PropType<"ltr" | "rtl">,
  },
  emits: {
    /** Each applied change, in the space of the colour you passed. */
    valueChange: (_color: Color, _details: ColorChangeDetails) => true,
    "update:modelValue": (_color: Color) => true,
    /** Once at the end of each interaction that changed the colour. */
    valueCommit: (_color: Color, _details: ColorCommitDetails) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const loc = useLocale(
      () => props.locale,
      () => props.dir,
    )
    const messages = useMessages("color-slider", colorSliderMessages, () => props.messages)
    const value = useColorProp(() => props.modelValue ?? undefined, "value", "color-slider")
    const defaultValue = useColorProp(
      () => props.defaultValue ?? undefined,
      "defaultValue",
      "color-slider",
    )
    const space = colorSliderSpace(props.channel, props.colorSpace, value() ?? defaultValue())
    const machineProps = () => ({
      value: value(),
      defaultValue: defaultValue(),
      space,
      fallback: DEFAULT,
      onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
        // A form reset restores the default without a callback (as every form control).
        if (d.reason === "RESET") return
        const reason = (d.event as { reason?: string }).reason ?? d.reason
        emit("valueChange", c, { reason, space, cancel: d.cancel })
        emit("update:modelValue", c)
      },
      onValueCommit: (c: Color, d: ColorCommitDetails) => emit("valueCommit", c, d),
    })
    const { view, send } = useMachine(colorValueMachine, machineProps, {})
    const color = () =>
      workingOf(
        machineProps(),
        view.value.context,
        colorValueOf(machineProps(), view.value.values.value),
      )
    const api = computed(() =>
      colorSliderConnect({
        color: color(),
        channel: props.channel,
        memory: view.value.context.memory,
        orientation: props.orientation,
        dir: loc.value.dir,
        messages: messages.value,
        locale: loc.value.locale,
        colorName: props.colorName,
      }),
    )
    const labelled = shallowRef(false)
    provide(ColorSliderKey, {
      data: () => api.value.data,
      trackStyle: () => style(api.value.trackStyle),
      thumbStyle: () => style(api.value.thumbStyle),
      setLabelled: (on) => (labelled.value = on),
    })
    provide(SliderRootSurfaceKey, true)
    provide(SliderNamingKey, channelSliderNaming)
    return () => {
      const a = api.value
      const def = defaultValue()
      const { style: ownStyle, ...rest } = attrs as Record<string, unknown>
      return h(
        Slider.Root,
        {
          ...rest,
          ...a.data,
          modelValue: a.slider.value,
          // What the hidden input's value attribute and a form reset show.
          ...(def ? { defaultValue: getChannel(def, props.channel) } : {}),
          min: a.slider.min,
          max: a.slider.max,
          step: a.slider.step,
          largeStep: a.slider.largeStep,
          orientation: props.orientation,
          dir: loc.value.dir,
          locale: loc.value.locale,
          style: [style(a.surfaceStyle), style(colorVariables(color())), ownStyle],
          // Unlabelled: the group is named by the channel too, so it can be found by name.
          "aria-label":
            labelled.value || rest["aria-labelledby"] !== undefined
              ? rest["aria-label"]
              : (rest["aria-label"] ?? a.channelName),
          messages: {
            valueText: ({ value: v }: { value: number }) => a.valueText(v),
            // Unlabelled: the thumb is named by the channel.
            thumbLabel: () => (labelled.value ? "" : a.channelName),
          },
          onValueChange: (n: SliderValue, d: { event: { type: string } }) =>
            // The Slider's form reset is the colour's: every channel back to the default.
            d.event.type === "RESET"
              ? send({ type: "RESET" })
              : send({
                  type: "SET",
                  color: withChannel(color(), props.channel, Number(n), view.value.context.memory),
                  reason: "SLIDER",
                }),
          onValueCommit: (_n: SliderValue, d: { reason: unknown }) =>
            send({ type: "COMMIT", reason: String(d.reason) }),
        },
        slots,
      )
    }
  },
})

/** A Slider part with the binding's data attributes. */
function bound(name: string, part: unknown) {
  return defineComponent({
    name: `ColorSlider${name}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const ctx = useColorSlider(name)
      return () => h(part as never, { ...ctx.data(), ...attrs }, slots)
    },
  })
}

const Label = defineComponent({
  name: "ColorSliderLabel",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = useColorSlider("Label")
    onMounted(() => ctx.setLabelled(true))
    onBeforeUnmount(() => ctx.setLabelled(false))
    return () => h(Slider.Label, { ...ctx.data(), ...attrs }, slots)
  },
})
const ValueText = bound("ValueText", Slider.ValueText)
const Control = bound("Control", Slider.Control)
const Description = bound("Description", Slider.Description)

const Track = defineComponent({
  name: "ColorSliderTrack",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = useColorSlider("Track")
    return () => {
      const { style: own, ...rest } = attrs as Record<string, unknown>
      return h(Slider.Track, { ...ctx.data(), ...rest, style: [ctx.trackStyle(), own] }, slots)
    }
  },
})

const Thumb = defineComponent({
  name: "ColorSliderThumb",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = useColorSlider("Thumb")
    return () => {
      const { style: own, ...rest } = attrs as Record<string, unknown>
      return h(
        Slider.Thumb,
        { index: 0, ...ctx.data(), ...rest, style: [ctx.thumbStyle(), own] },
        slots,
      )
    }
  },
})

const TransparencyGrid = defineComponent({
  name: "ColorSliderTransparencyGrid",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const ctx = useColorSlider("TransparencyGrid")
    // The picker's scope last: a consumer prop never moves the part out of it.
    return () => h(Grid, { ...ctx.data(), ...attrs, scope: COLOR_PICKER_SCOPE }, slots)
  },
})

export const ColorSlider = {
  Root,
  Label,
  ValueText,
  Control,
  Track,
  Thumb,
  Description,
  TransparencyGrid,
}
