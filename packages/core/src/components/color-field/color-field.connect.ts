// Color Field parts (spec "Field Semantics", "Form Participation"): the text input and the
// hidden input carrying the canonical colour. Field wiring comes merged in `field`.

import { focusAttrs } from "../../a11y/focus"
import type { KeyDescription } from "../../a11y/keys"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import type { Color } from "../shared/color/color"
import { canonicalHex } from "../shared/color/format"
import { type ColorMessages, colorMessages } from "../shared/color/messages"
import type { FieldControlProps } from "../shared/field-control"
import type { ColorFieldEvent } from "./color-field.machine"
import { type ColorFieldFormat, colorFieldText } from "./color-field.text"

export interface ColorFieldMessages extends ColorMessages {
  /** The validity message of a draft that is not a colour. */
  readonly invalid: string
}

export const colorFieldMessages: ColorFieldMessages = {
  ...colorMessages,
  invalid: "Enter a valid color",
}

/** The machine event for a key, or null: Enter commits, Escape reverts only a dirty draft. */
export function colorFieldKeyEvent(k: KeyDescription, dirty: boolean): ColorFieldEvent | null {
  if (k.composing || k.alt || k.ctrl || k.meta) return null
  if (k.key === "Enter") return { type: "COMMIT" }
  if (k.key === "Escape" && dirty) return { type: "ESCAPE" }
  return null
}

export interface ColorFieldConnectInput {
  readonly instance: string
  readonly value: Color | null
  /** The text shown (the draft while dirty). */
  readonly draft: string | null
  readonly invalidDraft: boolean
  readonly format: ColorFieldFormat
  readonly alpha: boolean
  readonly field: FieldControlProps
  readonly focused: boolean
  readonly modality: Modality
  readonly ids: { readonly input: string; readonly hiddenInput: string }
  readonly form?: string | undefined
  readonly defaultValue: Color | null
}

export function colorFieldConnect(input: ColorFieldConnectInput) {
  const { field } = input
  const invalid = field.invalid || input.invalidDraft
  const part = (name: string) => scopeAttrs("color-field", name, input.instance)
  const state = {
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-invalid": dataFlag(invalid),
    "data-dirty": dataFlag(input.draft !== null),
    ...focusAttrs(input.focused, input.modality),
  }
  const text = input.draft ?? colorFieldText(input.value, input.format, input.alpha)
  return {
    text,
    rootData: state,
    input: (): PartProps => ({
      ...part("input"),
      ...state,
      id: input.ids.input,
      type: "text",
      value: text,
      autocomplete: "off",
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      disabled: field.disabled || undefined,
      readonly: field.readOnly || undefined,
      "aria-required": field.required || field["aria-required"] === "true" ? "true" : undefined,
      "aria-invalid": invalid ? "true" : undefined,
      "aria-describedby": field["aria-describedby"],
      "aria-labelledby": field["aria-labelledby"],
      "aria-errormessage": field["aria-errormessage"],
      [CRITICAL]: ["type"],
    }),
    /** The form's value: `#RRGGBB(AA)`, empty for no colour. */
    hiddenInput: (): PartProps => ({
      ...part("hidden-input"),
      type: "text",
      id: input.ids.hiddenInput,
      "aria-hidden": "true",
      tabindex: -1,
      name: field.name,
      form: input.form,
      required: field.required || undefined,
      disabled: field.disabled || undefined,
      defaultValue: input.defaultValue ? canonicalHex(input.defaultValue) : "",
      style: hiddenFormInputStyle,
    }),
  }
}

/** What the hidden input submits for a colour. */
export const colorFieldFormValue = (color: Color | null) => (color ? canonicalHex(color) : "")
