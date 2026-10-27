// Editable parts (add-editable design §5–§7): the Preview is a button named by the Label and the
// value it shows (Zag names it "edit"); the visible Input has no name (the hidden input carries
// the committed value); the triggers are named from messages and the Label.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import type { LinkEnv } from "../../dom/link"
import { buttonLikeProps } from "../shared/button-like"
import type { EditableState } from "./editable.machine"
import type { EditableMessages } from "./editable.messages"

export type EditablePart =
  | "root"
  | "label"
  | "area"
  | "preview"
  | "input"
  | "control"
  | "edit-trigger"
  | "submit-trigger"
  | "cancel-trigger"
  | "hidden-input"

export interface EditableConnectInput {
  readonly instance: string
  readonly state: EditableState
  readonly value: string
  readonly draft: string
  readonly placeholder?: string | { readonly edit: string; readonly preview: string } | undefined
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly invalid: boolean
  readonly name?: string | undefined
  readonly maxLength?: number | undefined
  readonly messages: EditableMessages
  readonly ids: {
    readonly label: string
    readonly preview: string
    readonly input: string
    readonly hidden: string
  }
  readonly rendered: { readonly label: boolean }
}

export interface EditableFocusInput {
  readonly tag: string
  readonly focused: boolean
  readonly modality: Modality
}

export function editableConnect(input: EditableConnectInput, env: LinkEnv) {
  const empty = input.value === ""
  const editing = input.state === "edit"
  const ph =
    typeof input.placeholder === "string"
      ? { edit: input.placeholder, preview: input.placeholder }
      : input.placeholder
  const base = (part: EditablePart): PartProps => ({
    ...scopeAttrs("editable", part, input.instance),
    "data-state": input.state,
    "data-empty": dataFlag(empty),
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-invalid": dataFlag(input.invalid),
  })
  const labelId = input.rendered.label ? input.ids.label : undefined
  const trigger = (part: EditablePart, name: string, f: EditableFocusInput): PartProps => {
    const id = `${input.ids.preview}-${part}`
    return {
      ...buttonLikeProps(
        {
          role: "button",
          tag: f.tag,
          type: "button",
          disabled: input.disabled,
          focusableWhenDisabled: false,
        },
        env,
      ),
      ...base(part),
      ...focusAttrs(f.focused, f.modality),
      id,
      "aria-label": name,
      "aria-labelledby": labelId ? `${id} ${labelId}` : undefined,
    }
  }
  return {
    editing,
    /** What the Preview shows: the value, else the placeholder. */
    previewText: empty ? (ph?.preview ?? "") : input.value,
    root: (): PartProps => base("root"),
    label: (): PartProps => ({
      ...base("label"),
      id: input.ids.label,
      for: editing ? input.ids.input : undefined,
    }),
    area: (): PartProps => base("area"),
    preview: (f: EditableFocusInput): PartProps => ({
      ...buttonLikeProps(
        {
          role: "button",
          tag: f.tag,
          type: "button",
          disabled: input.disabled,
          focusableWhenDisabled: input.readOnly,
        },
        env,
      ),
      ...base("preview"),
      ...focusAttrs(f.focused, f.modality),
      id: input.ids.preview,
      hidden: editing ? true : undefined,
      "aria-labelledby": labelId ? `${labelId} ${input.ids.preview}` : undefined,
    }),
    input: (f: Omit<EditableFocusInput, "tag">): PartProps => ({
      ...base("input"),
      ...focusAttrs(f.focused, f.modality),
      id: input.ids.input,
      value: input.draft,
      hidden: editing ? undefined : true,
      placeholder: ph?.edit,
      maxlength: input.maxLength,
      disabled: input.disabled || undefined,
      readonly: input.readOnly || undefined,
      "aria-labelledby": labelId,
      "aria-invalid": input.invalid ? "true" : undefined,
    }),
    control: (): PartProps => base("control"),
    editTrigger: (f: EditableFocusInput): PartProps => ({
      ...trigger("edit-trigger", input.messages.edit, f),
      hidden: editing ? true : undefined,
    }),
    submitTrigger: (f: EditableFocusInput): PartProps => ({
      ...trigger("submit-trigger", input.messages.submit, f),
      hidden: editing ? undefined : true,
    }),
    cancelTrigger: (f: EditableFocusInput): PartProps => ({
      ...trigger("cancel-trigger", input.messages.cancel, f),
      hidden: editing ? undefined : true,
    }),
    hiddenInput: (): PartProps => ({
      ...base("hidden-input"),
      id: input.ids.hidden,
      type: "text",
      name: input.name,
      value: input.value,
      required: input.required || undefined,
      disabled: input.disabled || undefined,
      tabindex: -1,
      "aria-hidden": "true",
      style: hiddenFormInputStyle,
    }),
  }
}

export type EditableApi = ReturnType<typeof editableConnect>
