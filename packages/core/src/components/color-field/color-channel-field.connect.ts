// Color Channel Field (spec "Color Channel Field"): a Number Input with props computed from the
// channel; a commit becomes `withChannel`. No machine of its own.

import { channelRange, getChannel } from "../shared/color/channels"
import type { Color, ColorChannel, ColorMemory } from "../shared/color/color"

/** The Number Input's format for a channel ("120°", "50%", "50%" for alpha 0.5, "128"). */
export function channelFieldFormat(channel: ColorChannel): Intl.NumberFormatOptions {
  if (channel === "hue") {
    return { style: "unit", unit: "degree", unitDisplay: "narrow", maximumFractionDigits: 2 }
  }
  if (channel === "alpha") return { style: "percent", maximumFractionDigits: 0 }
  if (channel === "red" || channel === "green" || channel === "blue") {
    return { maximumFractionDigits: 0 }
  }
  return { style: "unit", unit: "percent", maximumFractionDigits: 2 }
}

/** The Number Input props for `channel` of `color`. */
export function colorChannelFieldProps(color: Color, channel: ColorChannel, memory?: ColorMemory) {
  const r = channelRange(color.space, channel)
  return {
    value: getChannel(color, channel, memory),
    min: r.min,
    max: r.max,
    step: r.step,
    largeStep: r.pageStep,
    formatOptions: channelFieldFormat(channel),
    commitBehavior: "snap" as const,
    "data-channel": channel,
  }
}
