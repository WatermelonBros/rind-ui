// Channel ranges and reads/writes (color-model "Channels And Ranges"). A channel the colour's
// space lacks is resolved by converting (zag#2389, ark#1649, react-spectrum#4561); writes clamp,
// round to the channel's precision and step through the shared decimal-safe snapping.

import { clamp, roundTo, snap } from "../step-math"
import {
  type Color,
  type ColorChannel,
  type ColorMemory,
  type ColorSpace,
  channelIndex,
  makeColor,
} from "./color"
import { toSpace } from "./convert"

export interface ChannelRange {
  readonly min: number
  readonly max: number
  readonly step: number
  readonly pageStep: number
  /** Decimals kept in the model. */
  readonly precision: number
}

const RANGES: Record<ColorChannel, ChannelRange> = {
  red: { min: 0, max: 255, step: 1, pageStep: 17, precision: 0 },
  green: { min: 0, max: 255, step: 1, pageStep: 17, precision: 0 },
  blue: { min: 0, max: 255, step: 1, pageStep: 17, precision: 0 },
  hue: { min: 0, max: 360, step: 1, pageStep: 15, precision: 2 },
  saturation: { min: 0, max: 100, step: 1, pageStep: 10, precision: 2 },
  lightness: { min: 0, max: 100, step: 1, pageStep: 10, precision: 2 },
  brightness: { min: 0, max: 100, step: 1, pageStep: 10, precision: 2 },
  alpha: { min: 0, max: 1, step: 0.01, pageStep: 0.1, precision: 2 },
}

/** The range of a channel (the same in every space that has it). */
export const channelRange = (_space: ColorSpace, channel: ColorChannel): ChannelRange =>
  RANGES[channel]

/** Clamped to the range and rounded to the precision. */
export const normalizeChannel = (channel: ColorChannel, value: number): number => {
  const r = RANGES[channel]
  return roundTo(clamp(Number.isFinite(value) ? value : r.min, r.min, r.max), r.precision)
}

/** The space a missing channel is read and written in. */
export function spaceForChannel(channel: ColorChannel): ColorSpace {
  if (channel === "red" || channel === "green" || channel === "blue") return "rgb"
  if (channel === "lightness") return "hsl"
  return "hsb"
}

/** The colour in a space that has `channel` (itself when it has it). */
export function colorWithChannel(color: Color, channel: ColorChannel, memory?: ColorMemory): Color {
  if (channel === "alpha" || channelIndex(color.space, channel) >= 0) return color
  return toSpace(color, spaceForChannel(channel), memory)
}

/** A channel's value; never throws for a named channel. */
export function getChannel(color: Color, channel: ColorChannel, memory?: ColorMemory): number {
  if (channel === "alpha") return color.alpha
  const c = colorWithChannel(color, channel, memory)
  return c.channels[channelIndex(c.space, channel)] ?? 0
}

/**
 * Sets a channel (clamped, rounded); a channel the space lacks converts first and returns the
 * colour in the converted space. The same object when nothing changes.
 */
export function withChannel(
  color: Color,
  channel: ColorChannel,
  value: number,
  memory?: ColorMemory,
): Color {
  const v = normalizeChannel(channel, value)
  if (channel === "alpha") {
    return v === color.alpha ? color : makeColor(color.space, color.channels, v)
  }
  const c = colorWithChannel(color, channel, memory)
  const i = channelIndex(c.space, channel)
  if (c.channels[i] === v) return c
  const channels: [number, number, number] = [c.channels[0], c.channels[1], c.channels[2]]
  channels[i] = v
  return makeColor(c.space, channels, c.alpha)
}

/**
 * The channel moved by `steps` of its step (or page step), snapped to the step grid: repeated
 * steps never accumulate floating-point error.
 */
export function stepChannel(
  color: Color,
  channel: ColorChannel,
  steps: number,
  options: { readonly page?: boolean | undefined; readonly memory?: ColorMemory | undefined } = {},
): Color {
  const r = RANGES[channel]
  const size = options.page ? r.pageStep : r.step
  const now = getChannel(color, channel, options.memory)
  const next = snap(now + steps * size, r.step, r.min)
  return withChannel(color, channel, next, options.memory)
}
