// The Color Area's axes (design §4), pure: default channels per space, validation, pointer
// fractions to channel values at the pointer resolution (react-spectrum#7553) in one write
// (kobalte#592), thumb position, key steps.

import { channelRange, getChannel, stepChannel, withChannel } from "../shared/color/channels"
import {
  type Color,
  type ColorChannel,
  type ColorMemory,
  type ColorSpace,
  SPACE_CHANNELS,
} from "../shared/color/color"
import { roundTo, snap } from "../shared/step-math"

declare const process: { env: { NODE_ENV?: string } }

export type AreaAxis = "x" | "y"

export interface AreaAxes {
  readonly space: ColorSpace
  readonly x: ColorChannel
  readonly y: ColorChannel
  /** The channel held constant. */
  readonly z: ColorChannel
}

const DEFAULTS: Record<ColorSpace, readonly [ColorChannel, ColorChannel]> = {
  hsb: ["saturation", "brightness"],
  hsl: ["saturation", "lightness"],
  rgb: ["red", "green"],
}

/** Pointer resolution per channel: finer than the keyboard step. */
export const pointerResolution = (channel: ColorChannel) =>
  channel === "red" || channel === "green" || channel === "blue" ? 1 : 0.1

/**
 * The axes for `space` and the channel props: the defaults when either is missing; a
 * development error and the defaults when they are not two different channels of the space.
 */
export function areaAxes(
  space: ColorSpace,
  xChannel?: ColorChannel | undefined,
  yChannel?: ColorChannel | undefined,
): AreaAxes {
  const chs = SPACE_CHANNELS[space] as readonly ColorChannel[]
  let [x, y] = DEFAULTS[space]
  if (xChannel !== undefined || yChannel !== undefined) {
    const wantX = xChannel ?? x
    const wantY = yChannel ?? y
    if (wantX !== wantY && chs.includes(wantX) && chs.includes(wantY)) {
      x = wantX
      y = wantY
    } else if (process.env.NODE_ENV !== "production") {
      console.error(
        `[rind-ui] color-area: xChannel "${wantX}" and yChannel "${wantY}" must be two different channels of "${space}"; using the defaults`,
      )
    }
  }
  return { space, x, y, z: chs.find((c) => c !== x && c !== y) ?? "hue" }
}

/** A channel's value as a fraction of its range. */
export function fractionOfChannel(color: Color, channel: ColorChannel, memory?: ColorMemory) {
  const r = channelRange(color.space, channel)
  return (getChannel(color, channel, memory) - r.min) / (r.max - r.min)
}

/** The thumb's position: fractions from the inline start and from the bottom. */
export const thumbPoint = (color: Color, axes: AreaAxes, memory?: ColorMemory) => ({
  x: fractionOfChannel(color, axes.x, memory),
  y: fractionOfChannel(color, axes.y, memory),
})

/** Both channels at a point (fractions), snapped to the pointer resolution: one write. */
export function colorAtPoint(
  color: Color,
  axes: AreaAxes,
  point: { readonly x: number; readonly y: number },
  memory?: ColorMemory,
): Color {
  const value = (ch: ColorChannel, f: number) => {
    const r = channelRange(color.space, ch)
    return roundTo(snap(r.min + f * (r.max - r.min), pointerResolution(ch), r.min), 1)
  }
  return withChannel(
    withChannel(color, axes.x, value(axes.x, point.x), memory),
    axes.y,
    value(axes.y, point.y),
    memory,
  )
}

/** One keyboard step on an axis (the channel's step, or its page step). */
export const stepAxis = (
  color: Color,
  axes: AreaAxes,
  axis: AreaAxis,
  steps: number,
  page: boolean,
  memory?: ColorMemory,
) => stepChannel(color, axes[axis], steps, { page, memory })

/** The axis's channel at its minimum or maximum. */
export function edgeAxis(
  color: Color,
  axes: AreaAxes,
  axis: AreaAxis,
  edge: "min" | "max",
  memory?: ColorMemory,
): Color {
  const r = channelRange(color.space, axes[axis])
  return withChannel(color, axes[axis], edge === "min" ? r.min : r.max, memory)
}

/** A native value set on an axis input: clamped and snapped to the channel's step. */
export function setAxis(color: Color, axes: AreaAxes, axis: AreaAxis, value: number): Color {
  const r = channelRange(color.space, axes[axis])
  return withChannel(color, axes[axis], snap(value, r.step, r.min))
}
