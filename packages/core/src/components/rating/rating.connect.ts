// Rating parts (design "Connect"): every aria-* and data-* attribute, the key mapping and the
// pointer fraction across a star. The one focusable element is a visually hidden native
// range input (role slider, so TalkBack and VoiceOver adjust it); the stars are decoration.

import { focusAttrs } from "../../a11y/focus"
import { type KeyDescription, toLogicalKeyEvent } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { visuallyHiddenInputStyle } from "../../dom/visually-hidden"
import type { PlatformFlags } from "../../env/capabilities"
import type { FieldControlProps } from "../shared/field-control"
import { isRatingKey, type RatingEvent, type RatingRange } from "./rating.machine"
import { type RatingMessages, ratingValueText } from "./rating.messages"

export type RatingPart = "root" | "label" | "control" | "item" | "input" | "hidden-input"

/** How full a star is drawn. */
export type RatingItemState = "full" | "half" | "empty"

/** The machine event for a key on the range input, or `null` (not ours: Tab, Enter, …). */
export function ratingKeyEvent(
  k: KeyDescription,
  a: { readonly dir: "ltr" | "rtl"; readonly platform: PlatformFlags },
): RatingEvent | null {
  // Alt / Ctrl / Meta + arrow belong to the browser and OS (history Back, word moves).
  if (k.composing || k.alt || k.ctrl || k.meta) return null
  const e = toLogicalKeyEvent(k, {
    dir: a.dir,
    orientation: "horizontal",
    platform: a.platform,
    value: true,
  })
  if (!e || !isRatingKey(e.type)) return null
  return { type: e.type, modality: "keyboard" }
}

/** The pointer's fraction across a star's box in reading order (RTL starts at the right). */
export function ratingFraction(
  box: { readonly left: number; readonly width: number },
  clientX: number,
  dir: "ltr" | "rtl",
): number {
  if (!(box.width > 0)) return 1
  const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
  return dir === "rtl" ? 1 - f : f
}

/** How full star `index` (1-based) is drawn at `value`. */
export const ratingItemState = (index: number, value: number): RatingItemState =>
  value >= index ? "full" : value >= index - 0.5 ? "half" : "empty"

export interface RatingConnectInput {
  readonly instance: string
  readonly dir: "ltr" | "rtl"
  readonly value: number
  /** The hover preview, or null. */
  readonly preview: number | null
  readonly range: RatingRange
  /** Merged with the Field and Fieldset (field-control). */
  readonly field: FieldControlProps
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  readonly focused: boolean
  readonly modality: Modality
  readonly ids: {
    readonly root: string
    readonly label: string
    readonly input: string
    readonly hiddenInput: string
  }
  /** The id that names the Rating (its own Label, or the Field's), when rendered. */
  readonly labelledBy: string | undefined
  readonly locale: string
  readonly messages: RatingMessages
  readonly form?: string | undefined
  /** The current `defaultValue` prop, normalised: the inputs' `value` attribute (reset). */
  readonly defaultValue: number
}

/** The submitted value: "" while unrated, so `required` fails with the browser's own message. */
const submitted = (value: number) => (value === 0 ? "" : String(value))

export function ratingConnect(input: RatingConnectInput) {
  const { field, range, value } = input
  const shown = input.preview ?? value
  const shared = {
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-required": dataFlag(field.required || field["aria-required"] === "true"),
    "data-invalid": dataFlag(field.invalid),
    "data-previewing": dataFlag(input.preview !== null),
  }
  // The ring belongs on the Control (around the stars) and the input, not on every part.
  const focus = focusAttrs(input.focused, input.modality)
  const part = (name: RatingPart) => scopeAttrs("rating", name, input.instance)

  return {
    root: (): PartProps => ({
      ...part("root"),
      ...input.fieldData,
      id: input.ids.root,
      dir: input.dir,
      "data-value": String(value),
      ...shared,
    }),
    /** No `for`: on iOS it overrides the input's own name (WebKit 172464, as Slider). */
    label: (): PartProps => ({ ...part("label"), id: input.ids.label, ...shared }),
    control: (): PartProps => ({
      ...part("control"),
      ...shared,
      ...focus,
      style: {
        position: "relative",
        display: "inline-flex",
        "user-select": "none",
        "-webkit-user-select": "none",
      },
    }),
    /** Star `index` (1-based): decoration, hidden from assistive technology. */
    item: (index: number): PartProps => {
      const highlighted = input.preview !== null && input.preview >= index - 0.5
      return {
        ...part("item"),
        ...shared,
        "aria-hidden": "true",
        "data-index": String(index),
        "data-state": ratingItemState(index, shown),
        "data-previewed": dataFlag(highlighted),
      }
    },
    /** The range input: the Rating's only focusable element, role slider. */
    input: (): PartProps => ({
      ...part("input"),
      ...focus,
      type: "range",
      id: input.ids.input,
      min: 0,
      max: range.count,
      step: range.step,
      // Not submitted: the hidden input carries the form value and the constraint.
      form: input.form,
      disabled: field.disabled || undefined,
      defaultValue: String(input.defaultValue),
      "aria-valuenow": value,
      "aria-valuemin": 0,
      "aria-valuemax": range.count,
      "aria-valuetext": ratingValueText({
        value,
        count: range.count,
        locale: input.locale,
        messages: input.messages,
      }),
      "aria-readonly": field.readOnly ? "true" : undefined,
      "aria-invalid": field["aria-invalid"],
      "aria-errormessage": field["aria-errormessage"],
      "aria-labelledby": field["aria-labelledby"] ?? input.labelledBy,
      "aria-describedby": field["aria-describedby"],
      style: {
        ...visuallyHiddenInputStyle,
        width: "100%",
        height: "100%",
        margin: "0",
        "pointer-events": "none",
      },
      [CRITICAL]: ["type", "aria-valuenow", "aria-valuetext"],
    }),
    /** The form carrier: the value ("" unrated), `required`, reset; focus goes to the input. */
    hiddenInput: (): PartProps => ({
      ...part("hidden-input"),
      id: input.ids.hiddenInput,
      "aria-hidden": "true",
      tabindex: -1,
      name: field.name,
      form: input.form,
      required: field.required || undefined,
      disabled: field.disabled || undefined,
      style: hiddenFormInputStyle,
      defaultValue: submitted(input.defaultValue),
    }),
  }
}

export type RatingApi = ReturnType<typeof ratingConnect>

/** The form carrier's value for a rating. */
export const ratingFormValue = submitted
