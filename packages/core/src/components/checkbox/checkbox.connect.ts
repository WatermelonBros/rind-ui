// Checkbox parts (design §5): the Control is button-like with role checkbox and an
// aria-checked that is never absent; Label/Description from control-label; the hidden
// input from hidden-form-input. TOGGLE comes from the press module's PRESS only.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import { controlLabel } from "../shared/control-label"
import type { FieldControlProps } from "../shared/field-control"
import type { CheckedState } from "./checkbox.machine"

export type CheckboxPart =
  | "root"
  | "control"
  | "indicator"
  | "label"
  | "description"
  | "hidden-input"

export interface CheckboxConnectInput {
  /** The component (Switch reuses this connect with its own scope, role and thumb). */
  readonly scope?: "checkbox" | "switch"
  readonly role?: "checkbox" | "switch"
  /** The decorative part's name ("indicator", or the Switch's "thumb"). */
  readonly indicatorPart?: "indicator" | "thumb"
  readonly instance: string
  readonly checked: CheckedState
  /** The control's rendered tag (a non-labelable `div` uses aria-labelledby). */
  readonly tag: string
  readonly labelable: boolean
  /** Merged with the Field and Fieldset (field-control). */
  readonly field: FieldControlProps
  readonly focusableWhenDisabled: boolean
  readonly focused: boolean
  readonly modality: Modality
  readonly pressed: boolean
  readonly hovered: boolean
  readonly ids: {
    readonly control: string
    readonly label: string
    readonly description: string
    readonly hiddenInput: string
  }
  /** Rendered own Label (the fallback names a non-labelable control with it). */
  readonly labelRendered: boolean
  /** The Field's validation data attributes (field-control). */
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  /** Hidden-input attributes. */
  readonly value: string
  readonly form?: string | undefined
  readonly defaultChecked: CheckedState
  readonly uncheckedValue?: string | undefined
}

const ariaChecked = (c: CheckedState) => (c === "indeterminate" ? "mixed" : String(c))
export const dataStateOf = (c: CheckedState) =>
  c === "indeterminate" ? "indeterminate" : c ? "checked" : "unchecked"

export function checkboxConnect(input: CheckboxConnectInput, env: LinkEnv) {
  const { field } = input
  const scope = input.scope ?? "checkbox"
  const role = input.role ?? "checkbox"
  const state = {
    "data-state": dataStateOf(input.checked),
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-required": dataFlag(field.required || field["aria-required"] === "true"),
    "data-invalid": dataFlag(field.invalid),
  }
  const labels = controlLabel({
    scope,
    instance: input.instance,
    controlId: input.ids.control,
    labelId: input.ids.label,
    descriptionId: input.ids.description,
    labelable: input.labelable,
    state,
  })
  const focus = focusAttrs(input.focused, input.modality)
  return {
    root: (): PartProps => ({
      ...scopeAttrs(scope, "root", input.instance),
      ...input.fieldData,
      ...state,
      ...focus,
    }),
    control: (): PartProps => ({
      ...buttonLikeProps(
        {
          role,
          tag: input.tag,
          disabled: field.disabled,
          focusableWhenDisabled: input.focusableWhenDisabled,
          type: "button",
        },
        env,
      ),
      ...scopeAttrs(scope, "control", input.instance),
      id: input.ids.control,
      // Kept on a substituted element too (ariakit#6336).
      role,
      "aria-checked": ariaChecked(input.checked),
      "aria-required": field.required || field["aria-required"] === "true" ? "true" : undefined,
      "aria-invalid": field["aria-invalid"],
      "aria-readonly": field.readOnly ? "true" : undefined,
      "aria-describedby": field["aria-describedby"],
      "aria-errormessage": field["aria-errormessage"],
      // Only a non-labelable control references its Label (a labelable one is named by `for`).
      "aria-labelledby":
        field["aria-labelledby"] ??
        (!input.labelable && input.labelRendered ? input.ids.label : undefined),
      ...state,
      ...focus,
      "data-pressed": dataFlag(input.pressed),
      "data-hover": dataFlag(input.hovered),
      // `type` too: a submit Switch or Checkbox would submit on every toggle (HUI#2935).
      [CRITICAL]: ["aria-checked", "role", "type"],
    }),
    indicator: (): PartProps => ({
      ...scopeAttrs(scope, input.indicatorPart ?? "indicator", input.instance),
      "aria-hidden": "true",
      ...state,
    }),
    label: labels.label,
    description: labels.description,
    /** The native input: name only here, never on the Control. */
    hiddenInput: (): PartProps => ({
      ...scopeAttrs(scope, "hidden-input", input.instance),
      type: "checkbox",
      id: input.ids.hiddenInput,
      "aria-hidden": "true",
      // Named by the visible control, for checkers that flag an unlabelled input anyway
      // (WAVE, reka-ui#3014); assistive technology never reaches it.
      "aria-labelledby": input.ids.control,
      tabIndex: -1,
      name: field.name,
      value: input.value,
      form: input.form,
      required: field.required || undefined,
      disabled: field.disabled || undefined,
      // The default a reset restores: the CURRENT defaultChecked prop, never the value.
      defaultChecked: input.defaultChecked === true,
      style: hiddenFormInputStyle,
    }),
    /** `name=uncheckedValue` while unchecked and enabled (`null`: not rendered). */
    uncheckedInput: (): PartProps | null =>
      input.uncheckedValue !== undefined &&
      field.name !== undefined &&
      input.checked !== true &&
      !field.disabled
        ? {
            type: "hidden",
            name: field.name,
            value: input.uncheckedValue,
            form: input.form,
            "data-scope": scope,
            "data-part": "unchecked-input",
          }
        : null,
  }
}
