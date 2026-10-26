// Angle Slider parts (add-angle-slider design §4–§6): a native range input is the only focusable
// element and the only thing announced; Control, Thumb, Value and markers are presentation.

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenInputStyle } from "../../dom/visually-hidden"
import { roundTo } from "../shared/step-math"
import type { AngleSliderEvent } from "./angle-slider.machine"
import { angleMax } from "./angle-slider.math"
import type { AngleSliderMessages } from "./angle-slider.messages"

export type AngleSliderPart =
  | "root"
  | "label"
  | "control"
  | "thumb"
  | "input"
  | "value"
  | "marker-group"
  | "marker"

/**
 * The machine event for a key on the input, or null (not ours). Not mirrored under RTL:
 * clockwise is clockwise (design §4). Escape only while dragging.
 */
export function angleSliderKeyEvent(
  k: KeyDescription,
  options: { readonly dragging: boolean },
): AngleSliderEvent | null {
  if (k.composing || k.alt || k.ctrl || k.meta) return null
  switch (k.key) {
    case "ArrowRight":
    case "ArrowUp":
      return { type: "STEP", steps: 1, page: k.shift }
    case "ArrowLeft":
    case "ArrowDown":
      return { type: "STEP", steps: -1, page: k.shift }
    case "PageUp":
      return { type: "STEP", steps: 1, page: true }
    case "PageDown":
      return { type: "STEP", steps: -1, page: true }
    case "Home":
      return { type: "EDGE", edge: "min" }
    case "End":
      return { type: "EDGE", edge: "max" }
    case "Escape":
      return options.dragging ? { type: "DRAG.CANCEL" } : null
    default:
      return null
  }
}

export interface AngleSliderConnectInput {
  readonly instance: string
  readonly value: number
  readonly defaultValue: number
  readonly step: number
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly invalid: boolean
  readonly focused: boolean
  readonly modality: Modality
  readonly locale: string
  readonly messages: AngleSliderMessages
  readonly ariaLabel?: string | undefined
  readonly ariaLabelledBy?: string | undefined
  readonly ids: { readonly label: string; readonly input: string }
  readonly rendered: { readonly label: boolean }
  readonly name?: string | undefined
  readonly form?: string | undefined
}

export function angleSliderConnect(input: AngleSliderConnectInput) {
  const { value } = input
  const max = angleMax(input.step)
  const formatted = new Intl.NumberFormat(input.locale, { maximumFractionDigits: 2 }).format(value)
  const valueText = input.messages.valueText({ value, formatted })
  const base = (part: AngleSliderPart): PartProps => ({
    ...scopeAttrs("angle-slider", part, input.instance),
    "data-dragging": dataFlag(input.dragging),
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-invalid": dataFlag(input.invalid),
  })
  const labelledBy =
    input.ariaLabelledBy ??
    (input.ariaLabel === undefined && input.rendered.label ? input.ids.label : undefined)
  return {
    value,
    valueText,
    formatted,
    max,
    root: (): PartProps => ({
      ...base("root"),
      style: {
        "--rind-angle-slider-angle": `${value}deg`,
        "--rind-angle-slider-fraction": String(roundTo(value / 360, 4)),
      },
    }),
    label: (): PartProps => ({ ...base("label"), id: input.ids.label, for: input.ids.input }),
    control: (): PartProps => ({
      ...base("control"),
      style: { position: "relative", "touch-action": "none", "user-select": "none" },
    }),
    // Not aria-hidden: the Input usually renders inside it (aria-hidden would hide the slider).
    thumb: (): PartProps => ({
      ...base("thumb"),
      ...focusAttrs(input.focused, input.modality),
      style: { rotate: "var(--rind-angle-slider-angle)" },
    }),
    input: (): PartProps => ({
      ...base("input"),
      ...focusAttrs(input.focused, input.modality),
      type: "range",
      id: input.ids.input,
      min: 0,
      max,
      step: input.step,
      value: String(value),
      defaultValue: String(input.defaultValue),
      name: input.name,
      form: input.form,
      disabled: input.disabled || undefined,
      // A read-only range input does not exist natively: the machine refuses the change.
      "aria-readonly": input.readOnly ? "true" : undefined,
      "aria-invalid": input.invalid ? "true" : undefined,
      "aria-label": input.ariaLabel,
      "aria-labelledby": labelledBy,
      "aria-valuetext": valueText,
      style: visuallyHiddenInputStyle,
    }),
    valuePart: (): PartProps => ({ ...base("value"), "aria-hidden": "true" }),
    markerGroup: (): PartProps => ({ ...base("marker-group"), "aria-hidden": "true" }),
    marker: (at: number): PartProps => ({
      ...base("marker"),
      "data-value": String(at),
      "data-state": at < value ? "under-value" : at === value ? "at-value" : "over-value",
      style: { "--rind-angle-slider-marker-angle": `${at}deg` },
    }),
  }
}

export type AngleSliderApi = ReturnType<typeof angleSliderConnect>
