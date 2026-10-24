<script lang="ts">
// Color Slider parts (design §5): a Slider bound to one channel of a colour. The colour value
// (Echo rule, hue memory, commits) is the shared colour-value machine; every Slider part is
// rendered as it is, with the binding's props and appearance.
import {
  type Color,
  type ColorCommitDetails,
  colorValueMachine,
  colorValueOf,
  getChannel,
  makeColor,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  channelSliderNaming,
  colorSliderConnect,
  colorSliderMessages,
  colorSliderSpace,
  colorVariables,
} from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { useLocale, useMessages } from "../provider"
import { sliderNaming, sliderRootSurface } from "../slider/context"
import SliderRoot from "../slider/slider-root.svelte"
import type { SliderRootProps, SliderValue } from "../slider/types"
import { useMachine } from "../use-machine.svelte"
import { colorSlider, joinStyle, styleText } from "./context"
import type { ColorSliderRootProps } from "./types"

let {
  channel,
  value = $bindable(),
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  colorName,
  messages: ownMessages,
  orientation = "horizontal",
  locale: ownLocale,
  dir: ownDir,
  style: ownStyle,
  children,
  ...rest
}: ColorSliderRootProps = $props()
const DEFAULT = makeColor("hsb", [0, 100, 100])
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("color-slider", colorSliderMessages, () => ownMessages)
const parsed = useColorProp(() => value, "value", "color-slider")
const parsedDefault = useColorProp(() => defaultProp, "defaultValue", "color-slider")
const controlled = untrack(() => value !== undefined)
const space = untrack(() => colorSliderSpace(channel, colorSpace, parsed() ?? parsedDefault()))
const machineProps = () => ({
  value: parsed(),
  defaultValue: parsedDefault(),
  space,
  fallback: DEFAULT,
  onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
    // A form reset restores the default without a callback (as every form control).
    if (d.reason === "RESET") return
    const reason = (d.event as { reason?: string }).reason ?? d.reason
    onValueChange?.(c, { reason, space, cancel: d.cancel })
    if (controlled) value = c
  },
  onValueCommit: (c: Color, d: ColorCommitDetails) => onValueCommit?.(c, d),
})
const machine = useMachine(colorValueMachine, machineProps, {})
const color = $derived(
  workingOf(
    machineProps(),
    machine.view.context,
    colorValueOf(machineProps(), machine.view.values.value),
  ),
)
const api = $derived(
  colorSliderConnect({
    color,
    channel,
    memory: machine.view.context.memory,
    orientation,
    dir: loc.current.dir,
    messages: messages(),
    locale: loc.current.locale,
    colorName,
  }),
)
let labelled = $state(false)
colorSlider.set({
  data: () => api.data,
  trackStyle: () => styleText(api.trackStyle),
  thumbStyle: () => styleText(api.thumbStyle),
  setLabelled: (on) =>
    untrack(() => {
      labelled = on
    }),
})
sliderRootSurface.set(true)
sliderNaming.set(channelSliderNaming)
const def = $derived(parsedDefault())
const ariaLabel = $derived(
  labelled || rest["aria-labelledby"] !== undefined
    ? rest["aria-label"]
    : (rest["aria-label"] ?? api.channelName),
)
const sliderMessages = $derived({
  valueText: ({ value: v }: { value: number }) => api.valueText(v),
  // Unlabelled: the thumb is named by the channel.
  thumbLabel: () => (labelled ? "" : api.channelName),
})
const onSlider = (n: SliderValue, d: { event: { type: string } }) =>
  // The Slider's form reset is the colour's: every channel back to the default.
  d.event.type === "RESET"
    ? machine.send({ type: "RESET" })
    : machine.send({
        type: "SET",
        color: withChannel(color, channel, Number(n), machine.view.context.memory),
        reason: "SLIDER",
      })
const onCommit = (_n: SliderValue, d: { reason: unknown }) =>
  machine.send({ type: "COMMIT", reason: String(d.reason) })
</script>

<SliderRoot
  {...rest as SliderRootProps}
  {...api.data}
  value={api.slider.value}
  {...def ? { defaultValue: getChannel(def, channel) } : {}}
  min={api.slider.min}
  max={api.slider.max}
  step={api.slider.step}
  largeStep={api.slider.largeStep}
  {orientation}
  dir={loc.current.dir}
  locale={loc.current.locale}
  style={joinStyle(styleText(api.surfaceStyle), styleText(colorVariables(color)), ownStyle as string)}
  aria-label={ariaLabel}
  messages={sliderMessages as never}
  onValueChange={onSlider as never}
  onValueCommit={onCommit as never}
  {children}
/>
