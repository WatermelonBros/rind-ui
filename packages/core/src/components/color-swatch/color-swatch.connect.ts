// Color Swatch (color-swatch spec): one element, `role="img"`, named by the colour; no machine.
// The colour is drawn inline (it is the content), with the variables the theme reads.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { type Color, makeColor } from "../shared/color/color"
import { formatColor } from "../shared/color/format"
import { type ColorMessages, colorMessages } from "../shared/color/messages"
import { type ColorNameProp, resolveColorName } from "../shared/color/name"
import { tryToColor } from "../shared/color/parse"

declare const process: { env: { NODE_ENV?: string } }

export interface ColorSwatchMessages extends ColorMessages {
  /** The role description (default "color swatch"). */
  readonly swatch: string
}

export const colorSwatchMessages: ColorSwatchMessages = { ...colorMessages, swatch: "color swatch" }

const TRANSPARENT = makeColor("rgb", [0, 0, 0], 0)

/** The colour a swatch shows: transparent black for a missing or unparsable value. */
export function swatchColor(input: unknown): Color {
  if (input === undefined || input === null) return TRANSPARENT
  const color = tryToColor(input)
  if (color) return color
  if (process.env.NODE_ENV !== "production") {
    console.error(`[rind-ui] color-swatch: "color" ${JSON.stringify(input)} is not a colour`)
  }
  return TRANSPARENT
}

/** The CSS custom properties every colour part carries. */
export const colorVariables = (color: Color) => ({
  "--rind-color": formatColor(color, "css"),
  "--rind-color-opaque": formatColor(makeColor(color.space, color.channels, 1), "css"),
})

export interface ColorSwatchInput {
  readonly instance: string
  readonly color: Color
  readonly respectAlpha?: boolean | undefined
  readonly messages: ColorSwatchMessages
  readonly locale?: string | undefined
  readonly colorName?: ColorNameProp | undefined
  /** The consumer's `aria-label`, added after the colour name. */
  readonly ariaLabel?: string | undefined
  /** Decorative (inside a named control): no role, `aria-hidden`. */
  readonly decorative?: boolean | undefined
}

/** The swatch's accessible name: the colour's, then the consumer's label. */
export function swatchName(input: ColorSwatchInput): string {
  const name = resolveColorName(input.color, input.messages, input.locale, input.colorName)
  return input.ariaLabel ? `${name}, ${input.ariaLabel}` : name
}

export function colorSwatchConnect(input: ColorSwatchInput) {
  const shown =
    input.respectAlpha === false
      ? makeColor(input.color.space, input.color.channels, 1)
      : input.color
  return {
    root: (scope = "color-swatch", part = "root"): PartProps => ({
      ...scopeAttrs(scope, part, input.instance),
      ...(input.decorative
        ? { "aria-hidden": "true" }
        : {
            role: "img",
            "aria-roledescription": input.messages.swatch,
            "aria-label": swatchName(input),
          }),
      "data-transparent": dataFlag(shown.alpha < 1),
      style: {
        "background-color": formatColor(shown, "css"),
        "forced-color-adjust": "none",
        ...colorVariables(input.color),
      },
    }),
  }
}

/** A checkerboard under a colour with transparency: decorative, never hit. */
export const transparencyGridProps = (scope: string, instance: string): PartProps => ({
  ...scopeAttrs(scope, "transparency-grid", instance),
  "aria-hidden": "true",
  style: { position: "absolute", inset: "0", "pointer-events": "none", "z-index": "-1" },
})
