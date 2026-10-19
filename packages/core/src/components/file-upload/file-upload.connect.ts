// File Upload parts (add-file-upload design §5): one real Trigger button over a hidden native
// file input (the form carrier and the chooser); a Dropzone with no role and no tab stop (no
// fake drop button: react-spectrum#5394, zag#3387); a visually hidden selection summary that
// describes the Trigger like the native "No file chosen".

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import type { FieldControlProps } from "../shared/field-control"
import { type FileLike, parseAccept } from "../shared/file-validation"
import type { FileUploadMessages } from "./file-upload.messages"

export type FileUploadPart =
  | "root"
  | "label"
  | "dropzone"
  | "trigger"
  | "hidden-input"
  | "summary"
  | "item-group"
  | "item"
  | "item-name"
  | "item-size"
  | "item-preview"
  | "item-remove"
  | "clear-trigger"

export interface FileUploadConnectInput {
  readonly instance: string
  readonly files: readonly FileLike[]
  readonly dragging: boolean
  /** Merged with the Field and Fieldset (field-control). */
  readonly field: FieldControlProps
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  readonly ids: {
    readonly label: string
    readonly trigger: string
    readonly input: string
    readonly summary: string
  }
  /** The id that names the control (own Label or the Field's), when rendered. */
  readonly labelledBy: string | undefined
  readonly messages: FileUploadMessages
  readonly locale: string
  readonly accept?: string | readonly string[] | undefined
  readonly maxFiles: number
  readonly directory: boolean
  readonly capture?: "user" | "environment" | undefined
  readonly form?: string | undefined
}

/** Bytes for the locale, base 1000 ("1.2 MB"). */
export function formatFileSize(bytes: number, locale: string): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const
  let value = bytes
  let i = 0
  while (value >= 1000 && i < units.length - 1) {
    value /= 1000
    i++
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[i],
    unitDisplay: "short",
    maximumFractionDigits: i === 0 ? 0 : 1,
  }).format(value)
}

export function fileUploadConnect(input: FileUploadConnectInput) {
  const { field } = input
  const empty = input.files.length === 0
  const shared = {
    "data-disabled": dataFlag(field.disabled),
    "data-readonly": dataFlag(field.readOnly),
    "data-required": dataFlag(field.required || field["aria-required"] === "true"),
    "data-invalid": dataFlag(field.invalid),
    "data-dragging": dataFlag(input.dragging),
    "data-empty": dataFlag(empty),
    ...input.fieldData,
  }
  const part = (name: FileUploadPart): PartProps => ({
    ...scopeAttrs("file-upload", name, input.instance),
    ...shared,
  })
  const describedBy = [input.ids.summary, field["aria-describedby"]].filter(Boolean).join(" ")
  return {
    root: (): PartProps => part("root"),
    label: (): PartProps => ({ ...part("label"), id: input.ids.label }),
    dropzone: (): PartProps => part("dropzone"),
    trigger: (t: {
      readonly focused: boolean
      readonly modality: Modality
      /** The consumer named it: used as given. */
      readonly named: boolean
    }): PartProps => ({
      ...part("trigger"),
      ...focusAttrs(t.focused, t.modality),
      id: input.ids.trigger,
      type: "button",
      // Read-only stays focusable and announced (aria-disabled), disabled is native.
      disabled: field.disabled || undefined,
      "aria-disabled": field.readOnly && !field.disabled ? "true" : undefined,
      // "CV, Choose file": the Label, then the Trigger's own content.
      "aria-labelledby":
        t.named || !input.labelledBy ? undefined : `${input.labelledBy} ${input.ids.trigger}`,
      "aria-describedby": describedBy || undefined,
      "aria-invalid": field.invalid ? "true" : undefined,
      [CRITICAL]: ["type"],
    }),
    /** The native input: the form carrier and the chooser; hidden from assistive technology. */
    hiddenInput: (): PartProps => ({
      ...part("hidden-input"),
      id: input.ids.input,
      type: "file",
      name: field.name,
      form: input.form,
      accept: parseAccept(input.accept).join(",") || undefined,
      multiple: input.maxFiles !== 1 || undefined,
      capture: input.capture,
      webkitdirectory: input.directory ? "" : undefined,
      required: field.required || undefined,
      disabled: field.disabled || undefined,
      tabindex: -1,
      "aria-hidden": "true",
      style: hiddenFormInputStyle,
      [CRITICAL]: ["type", "tabindex", "aria-hidden"],
    }),
    summary: (): PartProps => ({
      ...part("summary"),
      id: input.ids.summary,
      style: visuallyHiddenStyle,
    }),
    summaryText: input.messages.summary(
      { count: input.files.length, names: input.files.map((f) => f.name) },
      input.locale,
    ),
    itemGroup: (): PartProps => ({
      ...part("item-group"),
      "aria-label": input.messages.itemGroupLabel,
    }),
    item: (index: number): PartProps => ({ ...part("item"), "data-index": String(index) }),
    itemName: (): PartProps => part("item-name"),
    itemSize: (): PartProps => part("item-size"),
    itemSizeText: (file: FileLike) => formatFileSize(file.size, input.locale),
    itemPreview: (): PartProps => ({ ...part("item-preview"), alt: "" }),
    itemRemove: (file: FileLike, named: boolean): PartProps => ({
      ...part("item-remove"),
      type: "button",
      disabled: field.disabled || field.readOnly || undefined,
      "aria-label": named ? undefined : input.messages.removeLabel(file.name),
    }),
    clearTrigger: (named: boolean): PartProps => ({
      ...part("clear-trigger"),
      type: "button",
      disabled: field.disabled || field.readOnly || undefined,
      "aria-label": named ? undefined : input.messages.clearLabel,
    }),
  }
}
