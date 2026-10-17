// Color Swatch Picker (design §7): a Radio Group whose items are colours. Matching the colour to
// an item key is pure (react-spectrum#7918, #10251); every Radio Group rule applies unchanged.

import { type Color, makeColor } from "../shared/color/color"
import { isSameColor } from "../shared/color/equal"
import { alphaByte, formatColor } from "../shared/color/format"
import { type ColorMessages, colorMessages } from "../shared/color/messages"

export interface ColorSwatchPickerMessages extends ColorMessages {
  /** The group's name when the consumer gives none. */
  readonly swatchPickerLabel: string
}

export const colorSwatchPickerMessages: ColorSwatchPickerMessages = {
  ...colorMessages,
  swatchPickerLabel: "Color swatches",
}

/** An item's default key: the canonical `#RRGGBBAA` of its colour. */
export function swatchKey(color: Color): string {
  const hex = formatColor(makeColor(color.space, color.channels, 1), "hex")
  return `${hex}${alphaByte(color.alpha).toString(16).padStart(2, "0").toUpperCase()}`
}

export interface SwatchItem {
  readonly key: string
  readonly color: Color
  readonly disabled?: boolean | undefined
}

/**
 * The checked item for `value`: the last chosen one while its colour still matches, else the
 * first matching item in order, else none (never the first or a black swatch).
 */
export function matchSwatch(
  items: readonly SwatchItem[],
  value: Color | null,
  lastKey: string | null,
): string | null {
  if (!value) return null
  const last = lastKey === null ? undefined : items.find((i) => i.key === lastKey)
  if (last && isSameColor(last.color, value)) return last.key
  return items.find((i) => isSameColor(i.color, value))?.key ?? null
}

/**
 * The colour a pick sets: the swatch's, keeping the current alpha unless the swatch has
 * transparency (spec Color Picker "Swatches").
 */
export function pickedColor(swatch: Color, current: Color | null): Color {
  if (swatch.alpha < 1 || !current) return swatch
  return makeColor(swatch.space, swatch.channels, current.alpha)
}
