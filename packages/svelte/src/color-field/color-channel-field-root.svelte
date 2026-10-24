<script lang="ts">
// The Color Channel Field: a Number Input bound to one channel of a colour.
import {
  type Color,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  makeColor,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  channelInputNaming,
  colorChannelFieldProps,
  colorFieldMessages,
  colorVariables,
} from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { normalizeProps } from "../normalize-props"
import { numberInputNaming } from "../number-input/context"
import NumberInputRoot from "../number-input/number-input-root.svelte"
import type { NumberInputRootProps } from "../number-input/types"
import { useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { colorChannel } from "./context"
import type { ColorChannelFieldRootProps } from "./types"

let {
  channel,
  value = $bindable(),
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  style,
  children,
  ...rest
}: ColorChannelFieldRootProps = $props()
const CHANNEL_DEFAULT = makeColor("hsb", [0, 100, 100])
const parsed = useColorProp(() => value, "value", "color-channel-field")
const parsedDefault = useColorProp(() => defaultProp, "defaultValue", "color-channel-field")
const controlled = untrack(() => value !== undefined)
const space: ColorSpace = untrack(() => {
  const first = parsed() ?? parsedDefault()
  return (
    colorSpace ??
    (first && (channel === "alpha" || withChannel(first, channel, 0).space === first.space)
      ? first.space
      : channel === "red" || channel === "green" || channel === "blue"
        ? "rgb"
        : channel === "lightness"
          ? "hsl"
          : "hsb")
  )
})
const machineProps = () => ({
  value: parsed(),
  defaultValue: parsedDefault(),
  space,
  fallback: CHANNEL_DEFAULT,
  onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
    onValueChange?.(c, {
      reason: (d.event as { reason?: string }).reason ?? d.reason,
      space,
      cancel: d.cancel,
    })
    if (controlled) value = c
  },
  onValueCommit: (c: Color, d: { readonly reason: string }) => onValueCommit?.(c, d),
})
const machine = useMachine(colorValueMachine, machineProps, {})
const color = $derived(
  workingOf(
    machineProps(),
    machine.view.context,
    colorValueOf(machineProps(), machine.view.values.value),
  ),
)
const messages = useMessages("color-field", colorFieldMessages)
colorChannel.set(() => messages().channelName(channel))
numberInputNaming.set(channelInputNaming)
const numberProps = $derived(colorChannelFieldProps(color, channel, machine.view.context.memory))
const vars = $derived(
  (normalizeProps({ style: colorVariables(color) }) as { style?: string }).style ?? "",
)
const onNumber = (n: number | null) => {
  if (n === null) return
  machine.send({
    type: "SET",
    color: withChannel(color, channel, n, machine.view.context.memory),
    reason: "INPUT",
  })
}
const onCommit = (_n: number | null, d: { reason: unknown }) =>
  machine.send({ type: "COMMIT", reason: String(d.reason) })
</script>

<NumberInputRoot
  {...rest as NumberInputRootProps}
  min={numberProps.min}
  max={numberProps.max}
  step={numberProps.step}
  largeStep={numberProps.largeStep}
  formatOptions={numberProps.formatOptions}
  commitBehavior={numberProps.commitBehavior}
  value={numberProps.value}
  data-channel={numberProps["data-channel"]}
  style={[vars, style].filter(Boolean).join("; ")}
  onValueChange={onNumber}
  onValueCommit={onCommit as never}>{@render children?.()}</NumberInputRoot
>
