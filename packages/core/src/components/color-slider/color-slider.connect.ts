// Color Slider (design §5): a Slider bound to one channel of a colour. This module computes the
// Slider's props from the colour and the appearance the binding adds (track gradient, thumb
// colour, data-channel / data-space); no Slider rule is copied.

import { formatChannel } from "../shared/color/channel-format"
import { channelRange, colorWithChannel, getChannel } from "../shared/color/channels"
import {
  type Color,
  type ColorChannel,
  type ColorMemory,
  type ColorSpace,
  makeColor,
} from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { channelGradient, type GradientDirection } from "../shared/color/gradient"
import { type ColorMessages, colorMessages } from "../shared/color/messages"
import { type ColorNameProp, hueName, resolveColorName } from "../shared/color/name"

export interface ColorSliderValueTextArgs {
  readonly channel: string
  /** The channel's value, locale-formatted ("240°", "90%", "128"). */
  readonly value: string
  /** The colour name (for hue: the hue's name only; "" for alpha). */
  readonly colorName: string
}

export interface ColorSliderMessages extends ColorMessages {
  readonly valueText: (args: ColorSliderValueTextArgs) => string
}

export const colorSliderMessages: ColorSliderMessages = {
  ...colorMessages,
  valueText: ({ channel, value, colorName }) =>
    colorName ? `${channel} ${value}, ${colorName}` : `${channel} ${value}`,
}

/** The working space for a channel: the prop, else the colour's when it has it, else by channel. */
export function colorSliderSpace(
  channel: ColorChannel,
  colorSpace: ColorSpace | undefined,
  first: Color | undefined,
): ColorSpace {
  if (colorSpace) return colorSpace
  if (first && (channel === "alpha" || colorWithChannel(first, channel) === first))
    return first.space
  if (channel === "red" || channel === "green" || channel === "blue") return "rgb"
  if (channel === "lightness") return "hsl"
  return "hsb"
}

export interface ColorSliderInput {
  readonly color: Color
  readonly channel: ColorChannel
  readonly memory?: ColorMemory | undefined
  readonly orientation: "horizontal" | "vertical"
  readonly dir: "ltr" | "rtl"
  readonly messages: ColorSliderMessages
  readonly locale: string
  readonly colorName?: ColorNameProp | undefined
}

/** The Slider's range and value for the channel, and the binding's attributes. */
export function colorSliderConnect(input: ColorSliderInput) {
  const { color, channel, memory, messages, locale } = input
  const r = channelRange(color.space, channel)
  const value = getChannel(color, channel, memory)
  const direction: GradientDirection =
    input.orientation === "vertical" ? "to top" : input.dir === "rtl" ? "to left" : "to right"
  const gradient = channelGradient(color, channel, { direction, memory })
  const opaque = makeColor(color.space, color.channels, 1)
  const thumbColor = channel === "alpha" ? color : opaque
  const name =
    channel === "alpha"
      ? ""
      : channel === "hue"
        ? hueName(colorWithChannel(color, "hue", memory), messages)
        : resolveColorName(opaque, messages, locale, input.colorName)
  const valueText = (v: number) =>
    messages.valueText({
      channel: messages.channelName(channel),
      value: formatChannel(channel, v, locale),
      colorName: name,
    })
  const data = { "data-channel": channel, "data-space": color.space }
  return {
    slider: { min: r.min, max: r.max, step: r.step, largeStep: r.pageStep, value },
    valueText,
    channelName: messages.channelName(channel),
    data,
    trackStyle: {
      "background-image": gradient,
      "--rind-color-slider-gradient": gradient,
      "forced-color-adjust": "none",
    },
    thumbStyle: { "--rind-color": formatColor(thumbColor, "css"), "forced-color-adjust": "none" },
    /** Without a Control the Root is the pointer surface: the Slider Control's surface styles. */
    surfaceStyle: {
      position: "relative",
      "touch-action": input.orientation === "vertical" ? "pan-x pinch-zoom" : "pan-y pinch-zoom",
      "user-select": "none",
      "-webkit-user-select": "none",
    },
  }
}
