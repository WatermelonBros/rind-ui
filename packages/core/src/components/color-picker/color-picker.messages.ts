// The Color Picker's strings (spec "Messages"): its own, the children's and the colour words,
// so one `messages` (or one provider scope) translates the whole picker.

import type { ColorAreaValueTextArgs } from "../color-area/color-area.messages"
import { colorAreaMessages } from "../color-area/color-area.messages"
import type { ColorSliderValueTextArgs } from "../color-slider/color-slider.connect"
import { colorSliderMessages } from "../color-slider/color-slider.connect"
import { type ColorMessages, colorMessages } from "../shared/color/messages"
import type { ColorPickerFormat } from "./color-picker.machine"

export interface ColorPickerMessages extends ColorMessages {
  /** The Trigger's name with the colour ("Choose color, vibrant blue"). */
  readonly trigger: (args: { readonly colorName: string }) => string
  /** The content's name when nothing else names it. */
  readonly dialogLabel: string
  readonly eyeDropper: string
  /** Announced after an eye-dropper pick. */
  readonly picked: (args: { readonly colorName: string }) => string
  /** The FormatSelect's name. */
  readonly format: string
  readonly formatOptions: (format: ColorPickerFormat) => string
  /** The FormatTrigger's name and its announcement. */
  readonly formatTrigger: (args: { readonly current: string; readonly next: string }) => string
  readonly formatChanged: (args: { readonly format: string }) => string
  // The children's, re-exported (Area, Slider, Swatch, Swatch Picker, Field).
  readonly areaLabel: string
  readonly inputLabel: (args: { readonly group: string | null; readonly channel: string }) => string
  readonly roleDescription: string
  readonly areaValueText: (args: ColorAreaValueTextArgs) => string
  readonly sliderValueText: (args: ColorSliderValueTextArgs) => string
  readonly swatch: string
  readonly swatchPickerLabel: string
  readonly invalid: string
}

const FORMAT_LABELS: Record<ColorPickerFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  hsb: "HSB",
}

export const colorPickerMessages: ColorPickerMessages = {
  ...colorMessages,
  trigger: ({ colorName }) => `Choose color, ${colorName}`,
  dialogLabel: "Choose a color",
  eyeDropper: "Pick a color from the screen",
  picked: ({ colorName }) => `Picked ${colorName}`,
  format: "Color format",
  formatOptions: (format) => FORMAT_LABELS[format],
  formatTrigger: ({ current, next }) => `Color format ${current}, switch to ${next}`,
  formatChanged: ({ format }) => `Color format ${format}`,
  areaLabel: colorAreaMessages.areaLabel,
  inputLabel: colorAreaMessages.inputLabel,
  roleDescription: colorAreaMessages.roleDescription,
  areaValueText: colorAreaMessages.valueText,
  sliderValueText: colorSliderMessages.valueText,
  swatch: "color swatch",
  swatchPickerLabel: "Color swatches",
  invalid: "Enter a valid color",
}

/** The next format of the FormatTrigger's cycle. */
export const nextFormat = (f: ColorPickerFormat): ColorPickerFormat =>
  f === "hex" ? "rgb" : f === "rgb" ? "hsl" : f === "hsl" ? "hsb" : "hex"

export const PICKER_FORMATS: readonly ColorPickerFormat[] = ["hex", "rgb", "hsl", "hsb"]
