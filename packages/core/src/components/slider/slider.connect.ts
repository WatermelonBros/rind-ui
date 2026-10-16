// Slider parts (design §4): every aria-* and data-* attribute, the positions (pure functions
// of the values, so server and client render the same strings, RX#615) and the key mapping.
// One axis function decides direction for keys, positions and pointer mapping.

import { focusAttrs } from "../../a11y/focus"
import { type KeyDescription, toLogicalKeyEvent } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { DragAxis } from "../../dom/pointer-drag"
import { visuallyHiddenInputStyle } from "../../dom/visually-hidden"
import type { PlatformFlags } from "../../env/capabilities"
import type { FieldControlProps } from "../shared/field-control"
import type { SliderEvent } from "./slider.machine"
import { isSliderKey } from "./slider.machine"
import {
  fractionOf,
  type SliderOrientation,
  type SliderRange,
  type ThumbAlignment,
  thumbBounds,
} from "./slider.math"
import { type SliderMessages, sliderValueText, thumbValueTexts } from "./slider.messages"

export type SliderPart =
  | "root"
  | "label"
  | "value-text"
  | "control"
  | "track"
  | "indicator"
  | "thumb"
  | "hidden-input"
  | "marker-group"
  | "marker"
  | "description"

export interface SliderAxis {
  readonly orientation: SliderOrientation
  readonly dir: "ltr" | "rtl"
}

/** The pointer-drag axis: the reading direction mirrors only a horizontal Slider. */
export const sliderDragAxis = (a: SliderAxis, inset?: Element | null): DragAxis => ({
  axis: a.orientation,
  dir: a.orientation === "horizontal" ? a.dir : "ltr",
  inset: inset ?? null,
})

/**
 * A thumb's machine event for a key, or `null` (not ours). Escape is handled only while
 * dragging (`DRAG.CANCEL`); Enter is left to implicit submission.
 */
export function sliderKeyEvent(
  k: KeyDescription,
  index: number,
  a: SliderAxis & { readonly platform: PlatformFlags; readonly dragging: boolean },
): SliderEvent | null {
  if (k.composing) return null
  const e = toLogicalKeyEvent(k, {
    dir: a.dir,
    orientation: a.orientation,
    platform: a.platform,
    value: true,
  })
  if (!e) return null
  if (e.type === "DISMISS") return a.dragging ? { type: "DRAG.CANCEL" } : null
  if (!isSliderKey(e.type)) return null
  return { type: e.type, thumb: index, shift: e.shift, modality: "keyboard" }
}

export interface SliderConnectInput extends SliderAxis {
  readonly instance: string
  readonly values: readonly number[]
  readonly range: SliderRange
  readonly alignment: ThumbAlignment
  /** Merged with the Field and Fieldset (field-control). */
  readonly field: FieldControlProps
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  readonly thumbDisabled: readonly boolean[]
  readonly focused: number | null
  readonly modality: Modality
  readonly active: number | null
  /** The dragged thumb (null on an undecided stack) and whether a drag is active. */
  readonly draggingThumb: number | null
  readonly dragging: boolean
  readonly ids: {
    readonly root: string
    readonly label: string
    readonly description: string
    readonly input: (index: number) => string
  }
  /** The id that names the Slider (its own Label, or the Field's), when rendered. */
  readonly labelledBy: string | undefined
  readonly locale: string
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  readonly messages: SliderMessages
  readonly form?: string | undefined
  /** The current `defaultValue` prop, normalised: the inputs' `value` attribute (reset). */
  readonly defaultValues: readonly number[]
}

export interface ThumbOwn {
  /** The Thumb's own `disabled` (known on the server before the Root hears of it). */
  readonly disabled?: boolean | undefined
  readonly ariaLabel?: string | undefined
  readonly ariaLabelledBy?: string | undefined
  readonly name?: string | undefined
}

const pct = (n: number) => `${Math.round(n * 1e6) / 1e6}%`

/** The CSS offset of a point at `percent` along the axis (`contain` keeps thumbs inside). */
function offset(percent: number, alignment: ThumbAlignment): string {
  if (alignment === "center") return pct(percent)
  const size = "var(--rind-slider-thumb-size, 0px)"
  return `calc(${size} / 2 + (100% - ${size}) * ${Math.round(percent * 1e6) / 1e8})`
}

export function sliderConnect(input: SliderConnectInput) {
  const { field, range, values, orientation, dir, alignment } = input
  const vertical = orientation === "vertical"
  const count = values.length
  const percents = values.map((v) => fractionOf(v, range) * 100)
  const texts = thumbValueTexts(input)
  const thumbOff = (i: number) => field.disabled || input.thumbDisabled[i] === true
  const anyFocused = input.focused !== null
  const shared = {
    "data-orientation": orientation,
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-required": dataFlag(field.required || field["aria-required"] === "true"),
    "data-invalid": dataFlag(field.invalid),
    "data-dragging": dataFlag(input.dragging),
    ...focusAttrs(anyFocused, input.modality),
  }
  const part = (name: SliderPart) => scopeAttrs("slider", name, input.instance)
  /** The position of a point at `percent`: logical start (or bottom), centred on it. */
  const at = (percent: number) =>
    vertical
      ? { position: "absolute", bottom: offset(percent, alignment), translate: "0 50%" }
      : {
          position: "absolute",
          "inset-inline-start": offset(percent, alignment),
          // Physical: a logical start in RTL is the right edge, so centring moves right.
          translate: dir === "rtl" ? "50% 0" : "-50% 0",
        }
  const start = count > 1 ? (percents[0] ?? 0) : 0
  const end = count > 1 ? (percents[count - 1] ?? 0) : (percents[0] ?? 0)
  const describedBy = field["aria-describedby"]

  return {
    root: (): PartProps => ({
      ...part("root"),
      ...input.fieldData,
      id: input.ids.root,
      role: "group",
      "aria-labelledby": input.labelledBy,
      dir,
      ...shared,
      [CRITICAL]: ["role"],
    }),
    /** No `for`: on iOS it overrides the thumbs' own names (WebKit 172464). */
    label: (): PartProps => ({ ...part("label"), id: input.ids.label, ...shared }),
    valueText: (): PartProps & { readonly text: string } => ({
      ...part("value-text"),
      ...shared,
      text: sliderValueText(input),
    }),
    control: (): PartProps => ({
      ...part("control"),
      ...shared,
      style: {
        position: "relative",
        "touch-action": vertical ? "pan-x pinch-zoom" : "pan-y pinch-zoom",
        "user-select": "none",
        "-webkit-user-select": "none",
      },
    }),
    track: (): PartProps => ({ ...part("track"), ...shared }),
    indicator: (): PartProps => {
      const from = offset(start, alignment)
      const to = offset(end, alignment)
      const size = alignment === "center" ? pct(end - start) : `calc(${to} - ${from})`
      return {
        ...part("indicator"),
        ...shared,
        style: {
          "--rind-slider-start": pct(start),
          "--rind-slider-end": pct(end),
          position: "absolute",
          ...(vertical
            ? { bottom: count > 1 ? from : "0", "block-size": count > 1 ? size : to }
            : {
                "inset-inline-start": count > 1 ? from : "0",
                "inline-size": count > 1 ? size : to,
              }),
        },
      }
    },
    thumb: (index: number, own: ThumbOwn = {}): PartProps => ({
      ...part("thumb"),
      ...shared,
      "data-index": String(index),
      "data-disabled": dataFlag(thumbOff(index) || own.disabled === true),
      "data-dragging": dataFlag(input.dragging && input.draggingThumb === index),
      "data-active": dataFlag(input.active === index),
      ...focusAttrs(input.focused === index, input.modality),
      style: {
        ...at(percents[index] ?? 0),
        "--rind-slider-thumb-percent": pct(percents[index] ?? 0),
        "touch-action": "none",
        // The last used thumb stays on top of a stack.
        ...(input.active === index ? { "z-index": "1" } : {}),
      },
    }),
    /** The thumb's native range input: its only focusable element, role slider. */
    input: (index: number, own: ThumbOwn = {}): PartProps => {
      const [lo, hi] = thumbBounds(values, index, range)
      const id = input.ids.input(index)
      // The consumer's naming is used as given. Otherwise the thumb name follows the
      // Label's (aria-labelledby: label, self); without a thumb name the self reference
      // would read the value, so the Label alone names it.
      const consumer = own.ariaLabelledBy !== undefined || own.ariaLabel !== undefined
      const thumbName = consumer ? own.ariaLabel : input.messages.thumbLabel(index, count)
      const labelledBy = consumer
        ? own.ariaLabelledBy
        : [input.labelledBy, thumbName ? id : undefined].filter(Boolean).join(" ") || undefined
      return {
        ...part("hidden-input"),
        "data-index": String(index),
        // The focused element itself shows the ring state too (its Thumb mirrors it).
        ...focusAttrs(input.focused === index, input.modality),
        type: "range",
        id,
        min: lo,
        max: hi,
        step: range.step,
        name: own.name ?? field.name,
        form: input.form,
        disabled: thumbOff(index) || own.disabled === true || undefined,
        // The default a reset restores: the CURRENT defaultValue prop, never the value.
        defaultValue: String(input.defaultValues[index] ?? range.min),
        "aria-valuenow": values[index],
        "aria-valuemin": lo,
        "aria-valuemax": hi,
        "aria-valuetext": texts[index],
        "aria-orientation": vertical ? "vertical" : undefined,
        "aria-readonly": field.readOnly ? "true" : undefined,
        "aria-invalid": field["aria-invalid"],
        "aria-errormessage": field["aria-errormessage"],
        "aria-labelledby": labelledBy,
        "aria-label": thumbName || undefined,
        "aria-describedby": describedBy,
        style: {
          ...visuallyHiddenInputStyle,
          width: "100%",
          height: "100%",
          margin: "0",
          "pointer-events": "none",
          ...(vertical ? { "writing-mode": "vertical-lr", direction: "rtl" } : {}),
        },
        [CRITICAL]: ["type", "aria-valuenow", "aria-valuetext"],
      }
    },
    markerGroup: (): PartProps => ({ ...part("marker-group"), ...shared, "aria-hidden": "true" }),
    marker: (value: number): PartProps => {
      const p = fractionOf(value, range) * 100
      // Under the value: covered by the Indicator (below a single thumb, between the outer
      // thumbs of a range).
      const lo = count > 1 ? (values[0] ?? range.min) : Number.NEGATIVE_INFINITY
      const hi = values[count - 1] ?? range.min
      const state = values.includes(value)
        ? "at-value"
        : value > lo && value < hi
          ? "under-value"
          : "over-value"
      return {
        ...part("marker"),
        ...shared,
        "data-value": String(value),
        "data-state": state,
        style: at(p),
      }
    },
    description: (): PartProps => ({
      ...part("description"),
      id: input.ids.description,
      ...shared,
    }),
  }
}

export type SliderApi = ReturnType<typeof sliderConnect>
