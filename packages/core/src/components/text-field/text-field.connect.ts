// Text Field parts (design §5): the input owns its value (uncontrolled) or shows the prop
// (controlled); every event becomes a machine event and a field-control report. The Field
// binding's attributes are merged by the caller (`mergeFieldProps`).

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import type { FieldControlProps, FieldControlReport } from "../shared/field-control"
import { defaultCount, type TextFieldEvent, type TextFieldReason } from "./text-field.machine"

export interface TextFieldConnectInput {
  readonly scope: string
  readonly instance: string
  readonly state: string
  readonly value: string
  readonly controlled: boolean
  readonly defaultValue: string | undefined
  readonly focused: boolean
  readonly modality: Modality
  readonly focusableWhenDisabled: boolean
  /** The Field binding merged with the control's own props. */
  readonly field: FieldControlProps
  /** The Field's validation data attributes (`binding.data`). */
  readonly fieldData: Readonly<Record<string, string | undefined>>
  /** The control element's id. */
  readonly controlId: string
  /** The CharacterCount's id while it is rendered (described by it). */
  readonly countId: string | undefined
  readonly limit: number | undefined
  readonly count: ((value: string) => number) | undefined
  readonly clearLabel: string
}

export interface TextFieldHandlers {
  readonly send: (event: TextFieldEvent) => void
  readonly report: ((event: FieldControlReport) => void) | undefined
  /** The reason of the Clear in progress (one-shot), else undefined. */
  readonly takeReason: () => TextFieldReason | undefined
}

type InputLike = { readonly currentTarget: { readonly value: string } }

const nativeComposing = (e: unknown) =>
  (e as { nativeEvent?: { isComposing?: boolean }; isComposing?: boolean }).nativeEvent
    ?.isComposing === true || (e as { isComposing?: boolean }).isComposing === true

export function textFieldConnect(input: TextFieldConnectInput, on: TextFieldHandlers) {
  const { field } = input
  const composing = input.state === "composing"
  const disabledNative = field.disabled && !input.focusableWhenDisabled
  const readOnly = field.readOnly || (field.disabled && input.focusableWhenDisabled)
  const editable = !field.disabled && !field.readOnly
  const data = (part: string) => ({
    ...scopeAttrs(input.scope, part, input.instance),
    ...input.fieldData,
  })
  const used = (input.count ?? defaultCount)(input.value)
  return {
    composing,
    clearable: editable && input.value !== "",
    countText: input.limit === undefined ? String(used) : `${used}/${input.limit}`,
    overLimit: input.limit !== undefined && used > input.limit,
    root: (): PartProps => ({
      ...data("root"),
      ...focusAttrs(input.focused, input.modality),
      "data-composing": dataFlag(composing),
    }),
    /** The input or textarea (`part`). */
    control: (part: "input" | "textarea"): PartProps => ({
      ...data(part),
      ...focusAttrs(input.focused, input.modality),
      "data-composing": dataFlag(composing),
      // The control's own state attributes agree with its ARIA (aria-disabled included).
      "data-disabled": dataFlag(field.disabled),
      "data-readonly": dataFlag(field.readOnly),
      "data-required": dataFlag(field.required || field["aria-required"] === "true"),
      id: input.controlId,
      name: field.name,
      // Uncontrolled the DOM owns the value; controlled, null/undefined render as "".
      ...(input.controlled ? { value: input.value } : { defaultValue: input.defaultValue }),
      disabled: disabledNative || undefined,
      readonly: readOnly || undefined,
      "aria-disabled": field.disabled && input.focusableWhenDisabled ? "true" : undefined,
      required: field.required || undefined,
      "aria-required": field["aria-required"],
      "aria-invalid": field["aria-invalid"],
      "aria-describedby":
        [field["aria-describedby"], input.countId].filter(Boolean).join(" ") || undefined,
      "aria-labelledby": field["aria-labelledby"],
      "aria-errormessage": field["aria-errormessage"],
      onInput: (e: unknown) => {
        const value = (e as InputLike).currentTarget.value
        const composingNow = nativeComposing(e)
        const reason = on.takeReason() ?? "INPUT"
        on.send({
          type: "INPUT",
          value,
          composing: composingNow,
          reason,
          event: (e as { nativeEvent?: Event }).nativeEvent ?? (e as Event),
        })
        on.report?.({ type: "change", value, user: true, composing: composingNow })
      },
      onCompositionStart: () => on.send({ type: "COMPOSITION.START" }),
      onCompositionEnd: (e: unknown) => {
        const value = (e as InputLike).currentTarget.value
        on.send({
          type: "COMPOSITION.END",
          value,
          event: (e as { nativeEvent?: Event }).nativeEvent ?? (e as Event),
        })
        // The committed value validates once (the Field sees a non-composing change).
        on.report?.({ type: "change", value, user: true, composing: false })
      },
      onFocus: () => on.send({ type: "FOCUS", modality: input.modality }),
      onBlur: () => on.send({ type: "BLUR" }),
      onKeyDown: (e: unknown) => {
        const k = e as { key: string; keyCode?: number; nativeEvent?: { isComposing?: boolean } }
        // IME guard: Enter that commits a composition is not a commit (Safari: keyCode 229).
        if (k.key !== "Enter" || nativeComposing(e) || k.keyCode === 229 || part === "textarea")
          return
        on.report?.({ type: "commit" })
      },
    }),
    clearTrigger: (): PartProps => ({
      ...data("clear-trigger"),
      "aria-label": input.clearLabel,
      tabindex: -1,
    }),
    characterCount: (id: string): PartProps => ({
      ...data("character-count"),
      id,
      "data-over-limit": dataFlag(input.limit !== undefined && used > input.limit),
    }),
  }
}
