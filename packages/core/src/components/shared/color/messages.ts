// The colour strings every colour component shares (color-model "Colour Names"): hue,
// lightness and chroma words, the name templates, channel and format names. English defaults;
// override per component or through the provider.

import type { ColorChannel, ColorFormat } from "./color"

export type ColorHueKey =
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "magenta"
  | "brown"
export type ColorLightnessKey = "veryDark" | "dark" | "light" | "veryLight"
export type ColorChromaKey = "vibrant" | "grayish" | "pale"

export interface ColorNameParts {
  /** The lightness word ("" for none). */
  readonly lightness: string
  /** The chroma word ("" for none). */
  readonly chroma: string
  /** The hue name, a compound ("red orange") or white, black, gray. */
  readonly hue: string
}

export interface ColorMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly pink: string
  readonly red: string
  readonly orange: string
  readonly yellow: string
  readonly green: string
  readonly cyan: string
  readonly blue: string
  readonly purple: string
  readonly magenta: string
  readonly brown: string
  readonly white: string
  readonly black: string
  readonly gray: string
  /** A hue between two named hues, past half-way to the second ("red orange"). */
  readonly compoundHue: (first: string, second: string) => string
  readonly veryDark: string
  readonly dark: string
  readonly light: string
  readonly veryLight: string
  readonly vibrant: string
  readonly grayish: string
  readonly pale: string
  readonly colorName: (parts: ColorNameParts) => string
  /** A colour with alpha below 1; `percent` is the locale-formatted transparency ("50%"). */
  readonly transparentColorName: (args: {
    readonly name: string
    readonly percent: string
  }) => string
  /** Alpha 0. */
  readonly transparent: string
  readonly channelName: (channel: ColorChannel) => string
  readonly formatName: (format: ColorFormat) => string
}

const CHANNEL_NAMES: Record<ColorChannel, string> = {
  red: "Red",
  green: "Green",
  blue: "Blue",
  hue: "Hue",
  saturation: "Saturation",
  lightness: "Lightness",
  brightness: "Brightness",
  alpha: "Alpha",
}

const FORMAT_NAMES: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  hsb: "HSB",
  css: "CSS",
}

export const colorMessages: ColorMessages = {
  pink: "pink",
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  cyan: "cyan",
  blue: "blue",
  purple: "purple",
  magenta: "magenta",
  brown: "brown",
  white: "white",
  black: "black",
  gray: "gray",
  compoundHue: (first, second) => `${first} ${second}`,
  veryDark: "very dark",
  dark: "dark",
  light: "light",
  veryLight: "very light",
  vibrant: "vibrant",
  grayish: "grayish",
  pale: "pale",
  colorName: ({ lightness, chroma, hue }) => [lightness, chroma, hue].filter(Boolean).join(" "),
  transparentColorName: ({ name, percent }) => `${name}, ${percent} transparent`,
  transparent: "transparent",
  channelName: (channel) => CHANNEL_NAMES[channel],
  formatName: (format) => FORMAT_NAMES[format],
}
