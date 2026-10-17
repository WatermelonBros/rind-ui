// CSS gradients for slider tracks and areas (color-model "Gradients"): pure strings whose stop
// colours are the model's colours at the stop positions. An area stacks two gradients for the
// third channel fixed; an rgb area blends them with `screen` (each layer carries other channels
// as 0, so the blend adds exactly).

import { roundTo } from "../step-math"
import { channelRange, colorWithChannel, getChannel, withChannel } from "./channels"
import {
  type Color,
  type ColorChannel,
  type ColorMemory,
  type ColorSpace,
  makeColor,
  SPACE_CHANNELS,
} from "./color"
import { toSpace } from "./convert"
import { formatColor } from "./format"

export type GradientDirection = "to right" | "to left" | "to top"

const css = (c: Color) => formatColor(makeColor(c.space, c.channels, roundTo(c.alpha, 2)), "css")
const pct = (f: number) => `${roundTo(f * 100, 2)}%`
const opaque = (c: Color) => (c.alpha === 1 ? c : makeColor(c.space, c.channels, 1))

/** The stop colours of a channel's track, from minimum to maximum. */
export function channelStops(
  color: Color,
  channel: ColorChannel,
  memory?: ColorMemory,
): readonly { readonly at: number; readonly color: Color }[] {
  const base = colorWithChannel(color, channel, memory)
  if (channel === "alpha") {
    return [
      { at: 0, color: makeColor(base.space, base.channels, 0) },
      { at: 1, color: makeColor(base.space, base.channels, 1) },
    ]
  }
  const r = channelRange(base.space, channel)
  const fractions =
    channel === "hue"
      ? [0, 1, 2, 3, 4, 5, 6].map((i) => i / 6)
      : channel === "lightness"
        ? [0, 0.5, 1]
        : [0, 1]
  return fractions.map((at) => ({
    at,
    color: opaque(withChannel(base, channel, r.min + at * (r.max - r.min), memory)),
  }))
}

/** A slider track for `channel` with the other channels fixed. */
export function channelGradient(
  color: Color,
  channel: ColorChannel,
  options: {
    readonly direction?: GradientDirection | undefined
    readonly memory?: ColorMemory | undefined
  } = {},
): string {
  const stops = channelStops(color, channel, options.memory)
  const list = stops.map((s) => `${css(s.color)} ${pct(s.at)}`).join(", ")
  return `linear-gradient(${options.direction ?? "to right"}, ${list})`
}

/** The space of an area with these axes (the one that has both channels). */
export function areaSpace(x: ColorChannel, y: ColorChannel): ColorSpace {
  for (const space of ["hsb", "hsl", "rgb"] as const) {
    const chs = SPACE_CHANNELS[space] as readonly ColorChannel[]
    if (chs.includes(x) && chs.includes(y)) return space
  }
  return "hsb"
}

/** The channel an area holds constant. */
export function zChannel(space: ColorSpace, x: ColorChannel, y: ColorChannel): ColorChannel {
  return (SPACE_CHANNELS[space] as readonly ColorChannel[]).find((c) => c !== x && c !== y) ?? "hue"
}

/** The `background-blend-mode` an area's two layers need. */
export const areaBlendMode = (x: ColorChannel, y: ColorChannel) =>
  areaSpace(x, y) === "rgb" ? "screen" : "normal"

/**
 * The area's background-image: x increases along the inline axis (towards the left under
 * `rtl`), y upward; the third channel is the colour's.
 */
export function areaGradient(
  color: Color,
  x: ColorChannel,
  y: ColorChannel,
  options: { readonly rtl?: boolean | undefined; readonly memory?: ColorMemory | undefined } = {},
): string {
  const space = areaSpace(x, y)
  const inSpace = opaque(toSpace(color, space, options.memory))
  const dirOf = (ch: ColorChannel) => (ch === x ? (options.rtl ? "to left" : "to right") : "to top")
  const z = zChannel(space, x, y)
  const zValue = getChannel(inSpace, z, options.memory)
  const at = (h: number, s: number, t: number) => makeColor(space, [h, s, t], 1)
  const strip = (ch: ColorChannel, of: (v: number) => Color, fractions: readonly number[]) => {
    const r = channelRange(space, ch)
    const list = fractions
      .map((f) => `${css(of(r.min + f * (r.max - r.min)))} ${pct(f)}`)
      .join(", ")
    return `linear-gradient(${dirOf(ch)}, ${list})`
  }
  const hueStops = [0, 1, 2, 3, 4, 5, 6].map((i) => i / 6)
  if (space === "rgb") {
    const rgb = (ch: ColorChannel, v: number, withZ: boolean): Color => {
      const out: [number, number, number] = [0, 0, 0]
      out[SPACE_CHANNELS.rgb.indexOf(ch as "red")] = v
      if (withZ) out[SPACE_CHANNELS.rgb.indexOf(z as "red")] = zValue
      return makeColor("rgb", out, 1)
    }
    return [
      strip(y, (v) => rgb(y, v, true), [0, 1]),
      strip(x, (v) => rgb(x, v, false), [0, 1]),
    ].join(", ")
  }
  const third = space === "hsb" ? "brightness" : "lightness"
  // The overlay: the third channel (black → clear, or black → clear → white for lightness)
  // or, when the third channel is z, saturation (grey → clear).
  const overlay = (ch: ColorChannel, baseColor: (v: number) => Color): string => {
    const d = dirOf(ch)
    if (ch === "brightness") return `linear-gradient(${d}, #000000 0%, transparent 100%)`
    if (ch === "lightness") {
      return `linear-gradient(${d}, #000000 0%, transparent 50%, transparent 50%, #FFFFFF 100%)`
    }
    // saturation over a hue strip: the grey of the fixed third channel, fading out.
    return `linear-gradient(${d}, ${css(baseColor(0))} 0%, transparent 100%)`
  }
  const midThird = space === "hsl" ? 50 : 100
  if (z === "hue") {
    const sat = x === "saturation" ? x : y
    const t = x === third ? x : y
    const satLayer = strip(sat, (s) => at(zValue, s, midThird), [0, 1])
    return [overlay(t, () => at(0, 0, 0)), satLayer].join(", ")
  }
  if (z === "saturation") {
    const hue = x === "hue" ? x : y
    const t = x === third ? x : y
    return [
      overlay(t, () => at(0, 0, 0)),
      strip(hue, (h) => at(h, zValue, midThird), hueStops),
    ].join(", ")
  }
  // z is the third channel: a hue strip at full saturation, and saturation fading to grey.
  const hue = x === "hue" ? x : y
  const sat = x === "saturation" ? x : y
  return [
    overlay(sat, () => at(0, 0, zValue)),
    strip(hue, (h) => at(h, 100, zValue), hueStops),
  ].join(", ")
}
