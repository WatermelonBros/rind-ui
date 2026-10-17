// Colour names (color-model "Colour Names"): a locale-free description computed in OKLCH
// (CSS Color 4 matrices), then the strings of `messages`. The description has no words, so only
// the strings need translating.

import { format } from "../../../i18n/messages"
import { type Color, makeColor } from "./color"
import { toSpace } from "./convert"
import type { ColorHueKey, ColorLightnessKey, ColorMessages } from "./messages"

export interface ColorDescription {
  /** `null` for white, black and gray. */
  readonly hue: ColorHueKey | null
  /** A second hue key when the hue is past half-way to it. */
  readonly hue2: ColorHueKey | null
  readonly achromatic: "white" | "black" | "gray" | null
  readonly lightness: ColorLightnessKey | null
  readonly chroma: "vibrant" | "grayish" | "pale" | null
  /** 0 to 1. */
  readonly alpha: number
}

const linear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** OKLCH of the colour's sRGB value: lightness 0–1, chroma, hue in degrees. */
export function toOklch(color: Color): { l: number; c: number; h: number } {
  const [R, G, B] = toSpace(color, "rgb").channels.map(linear) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { l: L, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h }
}

/** Hue anchors in OKLCH degrees: a hue belongs to the last anchor at or below it. */
const ANCHORS: readonly (readonly [number, ColorHueKey])[] = [
  [0, "pink"],
  [20, "red"],
  [50, "orange"],
  [100, "yellow"],
  [135, "green"],
  [185, "cyan"],
  [255, "blue"],
  [290, "purple"],
  [320, "magenta"],
  [350, "pink"],
  [360, "pink"],
]

function hueKeys(h: number): readonly [ColorHueKey, ColorHueKey | null] {
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [start, key] = ANCHORS[i] ?? [0, "pink"]
    const [end, next] = ANCHORS[i + 1] ?? [360, "pink"]
    if (h >= start && h < end) {
      const past = (h - start) / (end - start) >= 0.5
      return [key, past && next !== key ? next : null]
    }
  }
  return ["pink", null]
}

/** The words a colour is described with, as keys. */
export function describeColor(color: Color): ColorDescription {
  const { l, c, h } = toOklch(color)
  const alpha = color.alpha
  if (l > 0.999 || l < 0.001 || c < 0.001) {
    const achromatic = l > 0.999 ? "white" : l < 0.001 ? "black" : "gray"
    return {
      hue: null,
      hue2: null,
      achromatic,
      lightness: achromatic === "gray" ? lightnessKey(l) : null,
      chroma: null,
      alpha,
    }
  }
  let [hue, hue2] = hueKeys(h)
  if (hue === "orange" && hue2 === null && l < 0.68) hue = "brown"
  if (hue === "yellow" && hue2 === null && l < 0.85) hue2 = "green"
  const chroma = c >= 0.15 ? "vibrant" : c <= 0.1 ? (l >= 0.7 ? "pale" : "grayish") : null
  // A vibrant colour is named by its hue alone ("vibrant blue", not "dark vibrant blue").
  return {
    hue,
    hue2,
    achromatic: null,
    lightness: chroma === "vibrant" ? null : lightnessKey(l),
    chroma,
    alpha,
  }
}

function lightnessKey(l: number): ColorLightnessKey | null {
  if (l < 0.3) return "veryDark"
  if (l < 0.55) return "dark"
  if (l > 0.85) return "veryLight"
  if (l >= 0.7) return "light"
  return null
}

/** The colour's name in `messages` (alpha 0: "transparent"). */
export function colorName(color: Color, messages: ColorMessages, locale = "en-US"): string {
  const d = describeColor(color)
  if (d.alpha <= 0) return messages.transparent
  const hue = d.achromatic
    ? messages[d.achromatic]
    : d.hue2
      ? messages.compoundHue(messages[d.hue ?? "pink"], messages[d.hue2])
      : messages[d.hue ?? "pink"]
  const name = messages.colorName({
    lightness: d.lightness ? messages[d.lightness] : "",
    chroma: d.chroma ? messages[d.chroma] : "",
    hue,
  })
  if (d.alpha >= 1) return name
  const percent = format.number(locale, { style: "percent" }).format(1 - d.alpha)
  return messages.transparentColorName({ name, percent })
}

/** Only the hue's name, at full saturation and brightness (a hue slider's value text: "blue"). */
export function hueName(color: Color, messages: ColorMessages): string {
  const h = color.space === "rgb" ? toSpace(color, "hsb").channels[0] : color.channels[0]
  const [hue, hue2] = hueKeys(toOklch(makeColor("hsb", [h, 100, 100])).h)
  return hue2 ? messages.compoundHue(messages[hue], messages[hue2]) : messages[hue]
}

/** A component's `colorName` prop: a fixed name, or a function replacing the computation. */
export type ColorNameProp = string | ((color: Color) => string)

/** The name a component exposes: the consumer's `colorName`, else `colorName()`. */
export function resolveColorName(
  color: Color,
  messages: ColorMessages,
  locale?: string,
  custom?: ColorNameProp,
): string {
  if (typeof custom === "string") return custom
  if (typeof custom === "function") return custom(color)
  return colorName(color, messages, locale)
}
