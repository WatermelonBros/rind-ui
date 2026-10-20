// The colour value (color-model "Colour Value"): plain, frozen data in `rgb`, `hsl` or `hsb`
// with alpha. Operations are functions, never methods, so a colour survives structuredClone,
// JSON and a server render (ark#2932).

declare const process: { env: { NODE_ENV?: string } }

export type ColorSpace = "rgb" | "hsl" | "hsb"

export type ColorChannel =
  | "red"
  | "green"
  | "blue"
  | "hue"
  | "saturation"
  | "lightness"
  | "brightness"
  | "alpha"

/** A text format: `css` is whatever a browser accepts for the colour. */
export type ColorFormat = "hex" | "rgb" | "hsl" | "hsb" | "css"

export interface Color {
  readonly space: ColorSpace
  /** In the space's order: red, green, blue · hue, saturation, lightness · hue, saturation, brightness. */
  readonly channels: readonly [number, number, number]
  /** 0 to 1. */
  readonly alpha: number
}

/** What every colour prop accepts: a colour, or a string `parseColor` reads. */
export type ColorInput = string | Color

/** Hue and saturation remembered across achromatic colours (design §3). */
export interface ColorMemory {
  readonly hue?: number | undefined
  readonly saturation?: number | undefined
}

export class ColorParseError extends Error {
  constructor(input: unknown) {
    super(`[rind-ui] color: cannot parse ${JSON.stringify(input)} as a colour`)
    this.name = "ColorParseError"
  }
}

export const SPACE_CHANNELS = {
  rgb: ["red", "green", "blue"],
  hsl: ["hue", "saturation", "lightness"],
  hsb: ["hue", "saturation", "brightness"],
} as const satisfies Record<ColorSpace, readonly [ColorChannel, ColorChannel, ColorChannel]>

export const COLOR_SPACES: readonly ColorSpace[] = ["rgb", "hsl", "hsb"]

/** The index of `channel` in `space`, or -1 (alpha and channels the space lacks). */
export const channelIndex = (space: ColorSpace, channel: ColorChannel): number =>
  (SPACE_CHANNELS[space] as readonly ColorChannel[]).indexOf(channel)

export const hasChannel = (space: ColorSpace, channel: ColorChannel): boolean =>
  channel === "alpha" || channelIndex(space, channel) >= 0

/** Builds a colour; frozen in development so an accidental mutation throws. */
/* @__NO_SIDE_EFFECTS__ */
export function makeColor(
  space: ColorSpace,
  channels: readonly [number, number, number],
  alpha = 1,
): Color {
  const color: Color = { space, channels: [channels[0], channels[1], channels[2]], alpha }
  if (process.env.NODE_ENV !== "production") {
    Object.freeze(color.channels)
    Object.freeze(color)
  }
  return color
}

export function isColor(v: unknown): v is Color {
  if (typeof v !== "object" || v === null) return false
  const c = v as Partial<Color>
  return (
    (c.space === "rgb" || c.space === "hsl" || c.space === "hsb") &&
    Array.isArray(c.channels) &&
    c.channels.length === 3 &&
    c.channels.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    typeof c.alpha === "number" &&
    Number.isFinite(c.alpha)
  )
}
