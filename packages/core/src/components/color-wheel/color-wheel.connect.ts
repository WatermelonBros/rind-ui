// Color Wheel (add-color-wheel design §1–§4): no machine of its own. The parts run the Angle
// Slider machine on the hue; this module maps the colour to that hue and back with Color
// Slider's binding (working space, memory, hue name, value text), and renders the parts.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenInputStyle } from "../../dom/visually-hidden"
import { angleMax, normalizeAngle } from "../angle-slider/angle-slider.math"
import { type ColorSliderMessages, colorSliderMessages } from "../color-slider/color-slider.connect"
import { formatChannel } from "../shared/color/channel-format"
import { getChannel, withChannel } from "../shared/color/channels"
import type { Color, ColorMemory, ColorSpace } from "../shared/color/color"
import { toSpace } from "../shared/color/convert"
import { formatColor } from "../shared/color/format"
import { hueName } from "../shared/color/name"

export type ColorWheelPart =
  | "root"
  | "label"
  | "track"
  | "thumb"
  | "input"
  | "value"
  | "hidden-input"

export type ColorWheelMessages = ColorSliderMessages
export const colorWheelMessages: ColorWheelMessages = colorSliderMessages

/** The working space: `hsl` unless `hsb` is asked for (both have a hue). */
export const colorWheelSpace = (space: ColorSpace | undefined): "hsl" | "hsb" =>
  space === "hsb" ? "hsb" : "hsl"

/** The hue the Angle Slider machine runs on: the colour's (or its memory's), on the step grid. */
export function hueOf(color: Color, step: number, memory?: ColorMemory): number {
  return normalizeAngle(getChannel(color, "hue", memory), step)
}

/** The colour with `hue`, in the working space, every other channel kept. */
export function colorWithHue(
  color: Color,
  hue: number,
  space: ColorSpace | undefined,
  memory?: ColorMemory,
): Color {
  return withChannel(toSpace(color, colorWheelSpace(space), memory), "hue", hue, memory)
}

/** The ring's hues, every 30°, as a conic gradient from the top, clockwise. */
export const wheelGradient = () =>
  `conic-gradient(from 0deg, ${Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 100% 50%)`).join(", ")})`

export interface ColorWheelConnectInput {
  readonly instance: string
  readonly color: Color
  readonly memory?: ColorMemory | undefined
  readonly step: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly invalid: boolean
  readonly focused: boolean
  readonly modality: Modality
  readonly locale: string
  readonly messages: ColorWheelMessages
  readonly ariaLabel?: string | undefined
  readonly ariaLabelledBy?: string | undefined
  readonly ids: { readonly label: string; readonly input: string }
  readonly rendered: { readonly label: boolean }
  readonly name?: string | undefined
  readonly form?: string | undefined
  /** The current `defaultValue` (the hidden input's reset value). */
  readonly defaultColor: Color
}

export function colorWheelConnect(input: ColorWheelConnectInput) {
  const { color, messages, memory } = input
  const hue = hueOf(color, input.step, memory)
  const valueText = messages.valueText({
    channel: messages.channelName("hue"),
    value: formatChannel("hue", hue, input.locale),
    colorName: hueName(withChannel(color, "hue", hue, memory), messages),
  })
  const base = (part: ColorWheelPart): PartProps => ({
    ...scopeAttrs("color-wheel", part, input.instance),
    "data-space": colorWheelSpace(color.space),
    "data-dragging": dataFlag(input.dragging),
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-invalid": dataFlag(input.invalid),
  })
  const labelledBy =
    input.ariaLabelledBy ??
    (input.ariaLabel === undefined && input.rendered.label ? input.ids.label : undefined)
  const gradient = wheelGradient()
  return {
    hue,
    valueText,
    /** Props for the Angle Slider machine. */
    angle: { value: hue, step: input.step, wrap: true },
    root: (): PartProps => ({
      ...base("root"),
      role: "group",
      "aria-labelledby": labelledBy,
      "aria-label": labelledBy ? undefined : (input.ariaLabel ?? messages.channelName("hue")),
      style: {
        "--rind-color-wheel-angle": `${hue}deg`,
        "--rind-color-wheel-thumb-color": `hsl(${hue} 100% 50%)`,
        "--rind-color": formatColor(color, "css"),
      },
      [CRITICAL]: ["role"],
    }),
    label: (): PartProps => ({ ...base("label"), id: input.ids.label, for: input.ids.input }),
    track: (): PartProps => ({
      ...base("track"),
      style: {
        position: "relative",
        "touch-action": "none",
        "user-select": "none",
        "-webkit-user-select": "none",
        "--rind-color-wheel-gradient": gradient,
        "forced-color-adjust": "none",
      },
    }),
    thumb: (): PartProps => ({
      ...base("thumb"),
      ...focusAttrs(input.focused, input.modality),
      style: { rotate: "var(--rind-color-wheel-angle)", "forced-color-adjust": "none" },
    }),
    input: (): PartProps => ({
      ...base("input"),
      ...focusAttrs(input.focused, input.modality),
      type: "range",
      id: input.ids.input,
      min: 0,
      max: angleMax(input.step),
      step: input.step,
      value: String(hue),
      defaultValue: String(hueOf(input.defaultColor, input.step)),
      disabled: input.disabled || undefined,
      "aria-readonly": input.readOnly ? "true" : undefined,
      "aria-invalid": input.invalid ? "true" : undefined,
      "aria-label": input.ariaLabel ?? (labelledBy ? undefined : messages.channelName("hue")),
      "aria-labelledby": labelledBy,
      "aria-valuetext": valueText,
      style: visuallyHiddenInputStyle,
    }),
    valuePart: (): PartProps => ({ ...base("value"), "aria-hidden": "true" }),
    /** The colour for forms (the range input has no name). */
    hiddenInput: (): PartProps => ({
      ...base("hidden-input"),
      type: "hidden",
      name: input.name,
      form: input.form,
      value: formatColor(color, "hex"),
      disabled: input.disabled || undefined,
    }),
  }
}

export type ColorWheelApi = ReturnType<typeof colorWheelConnect>
