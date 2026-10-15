// Field parts' props (design §4) from the machine's view: one display decides
// `data-valid` / `data-invalid`, the control's `aria-invalid` and the ErrorMessage.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { ValidityKey } from "../../dom/constraint-validity"
import type { FieldContext, FieldProps } from "./field.machine"
import { fieldIsDirty, fieldIsFilled } from "./field.machine"

export type FieldPart = "root" | "label" | "description" | "error-message"
export type FieldDisplay = "none" | "valid" | "invalid"

/** What is displayed: never while disabled; the `invalid` prop pins it. */
export function fieldDisplay(
  state: string,
  context: Pick<FieldContext, "shown">,
  props: Pick<FieldProps, "disabled" | "invalid">,
): FieldDisplay {
  if (props.disabled) return "none"
  if (props.invalid === true) return "invalid"
  if (props.invalid === false) return "valid"
  if (state === "validating") return context.shown
  return state === "valid" || state === "invalid" ? state : "none"
}

export interface FieldConnectInput {
  readonly instance: string
  readonly state: string
  readonly context: FieldContext
  readonly props: Pick<FieldProps, "disabled" | "readOnly" | "required" | "invalid">
  /** Controlled flags override the machine's. */
  readonly touched?: boolean | undefined
  readonly dirty?: boolean | undefined
  /** Focus mirrored from the control. */
  readonly modality: Modality
  /** The registered control (its id and whether a `for` can name it). */
  readonly control: { readonly id: string; readonly labelable: boolean } | null
  /** The dirty baseline: the value at the Field's first registration. */
  readonly initial: { readonly value: unknown } | null
}

export function fieldConnect(input: FieldConnectInput) {
  const { context, props } = input
  const display = fieldDisplay(input.state, context, props)
  const touched = input.touched ?? context.touched
  const dirty = input.dirty ?? fieldIsDirty(context, input.initial)
  const filled = fieldIsFilled(context)
  const data = (part: FieldPart) => ({
    ...scopeAttrs("field", part, input.instance),
    "data-disabled": dataFlag(props.disabled === true),
    "data-readonly": dataFlag(props.readOnly === true),
    "data-required": dataFlag(props.required === true),
    "data-valid": dataFlag(display === "valid"),
    "data-invalid": dataFlag(display === "invalid"),
    "data-validating": dataFlag(input.state === "validating"),
    "data-touched": dataFlag(touched),
    "data-dirty": dataFlag(dirty),
    "data-filled": dataFlag(filled),
  })
  const errorKey: ValidityKey | null =
    display === "invalid" ? (context.current?.key ?? "customError") : null
  return {
    display,
    /** The displayed messages (kept while validating). */
    messages: display === "invalid" ? (context.current?.messages ?? []) : [],
    /** The validity key behind the displayed error (`match`). */
    errorKey,
    /** The state attributes the registered control's own root carries too. */
    controlData: () => {
      const d = data("root")
      return {
        "data-valid": d["data-valid"],
        "data-invalid": d["data-invalid"],
        "data-validating": d["data-validating"],
        "data-touched": d["data-touched"],
        "data-dirty": d["data-dirty"],
        "data-filled": d["data-filled"],
      }
    },
    root: (): PartProps => ({
      ...data("root"),
      ...focusAttrs(context.focused, input.modality),
    }),
    /** `htmlFor`: the control's id when it is labelable (control-label rule). */
    label: (id: string): PartProps => ({
      ...data("label"),
      id,
      for: input.control?.labelable ? input.control.id : undefined,
    }),
    description: (id: string): PartProps => ({ ...data("description"), id }),
    errorMessage: (id: string): PartProps => ({ ...data("error-message"), id }),
  }
}
