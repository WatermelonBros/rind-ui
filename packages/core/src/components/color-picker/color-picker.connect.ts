// Color Picker parts of its own (spec "Trigger, Control And Labelling", "Form Participation",
// "Data Attributes"): the children are their own components, bound by the adapter.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { type Color, type ColorFormat, makeColor } from "../shared/color/color"
import { canonicalHex, formatColor } from "../shared/color/format"
import { type ColorNameProp, resolveColorName } from "../shared/color/name"
import type { ColorPickerFormat } from "./color-picker.machine"
import type { ColorPickerMessages } from "./color-picker.messages"

export interface ColorPickerConnectInput {
  readonly instance: string
  readonly color: Color
  readonly format: ColorPickerFormat
  readonly open: boolean
  readonly inline: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly invalid: boolean
  readonly dragging: boolean
  readonly messages: ColorPickerMessages
  readonly locale: string
  readonly colorName?: ColorNameProp | undefined
  readonly ids: {
    readonly control: string
    readonly trigger: string
    readonly label: string
    readonly content: string
    readonly hiddenInput: string
  }
  readonly labelRendered: boolean
  readonly name?: string | undefined
  readonly form?: string | undefined
  readonly required: boolean
  /** The form's text format (default the canonical hex). */
  readonly formFormat?: ColorFormat | undefined
  readonly defaultValue: Color
}

export function colorPickerConnect(input: ColorPickerConnectInput) {
  const { color, messages } = input
  const opaque = makeColor(color.space, color.channels, 1)
  const name = resolveColorName(color, messages, input.locale, input.colorName)
  const part = (p: string) => scopeAttrs("color-picker", p, input.instance)
  const shared = {
    "data-disabled": dataFlag(input.disabled),
    "data-readonly": dataFlag(input.readOnly),
    "data-invalid": dataFlag(input.invalid),
  }
  const formText = (c: Color) =>
    input.formFormat ? formatColor(c, input.formFormat) : canonicalHex(c)
  const label = input.labelRendered ? input.ids.label : undefined
  return {
    colorName: name,
    valueText: formatColor(color, input.format === "hex" ? "hex" : input.format),
    root: (): PartProps => ({
      ...part("root"),
      ...shared,
      "data-dragging": dataFlag(input.dragging),
      "data-inline": dataFlag(input.inline),
      "data-format": input.format,
      style: {
        "--rind-color": formatColor(color, "css"),
        "--rind-color-opaque": formatColor(opaque, "css"),
      },
    }),
    label: (): PartProps => ({ ...part("label"), id: input.ids.label, ...shared }),
    control: (): PartProps => ({
      ...part("control"),
      ...shared,
      id: input.ids.control,
      role: "group",
      "aria-labelledby": label,
      "aria-label": label ? undefined : messages.dialogLabel,
    }),
    trigger: (): PartProps => ({
      ...part("trigger"),
      ...shared,
      "aria-label": messages.trigger({ colorName: name }),
      "aria-labelledby": [input.ids.trigger, label].filter(Boolean).join(" "),
      "aria-disabled": input.readOnly ? "true" : undefined,
    }),
    /** The content's name: the consumer's, else trigger + label (inline: like the Control). */
    contentName: (own: { label?: string | undefined; labelledBy?: string | undefined }) =>
      own.label !== undefined || own.labelledBy !== undefined
        ? own
        : input.inline
          ? label
            ? { labelledBy: label }
            : { label: messages.dialogLabel }
          : { labelledBy: [input.ids.trigger, label].filter(Boolean).join(" ") },
    inlineContent: (): PartProps => ({
      ...part("content"),
      ...shared,
      id: input.ids.content,
      role: "group",
      "data-inline": "",
    }),
    valueTextPart: (): PartProps => ({ ...part("value-text"), ...shared }),
    view: (format: ColorPickerFormat): PartProps => ({
      ...part("view"),
      "data-format": format,
    }),
    formatSelect: (): PartProps => ({
      ...part("format-select"),
      ...shared,
      "aria-label": messages.format,
      disabled: input.disabled || undefined,
    }),
    eyeDropperTrigger: (supported: boolean): PartProps => ({
      ...part("eye-dropper-trigger"),
      ...shared,
      type: "button",
      "aria-label": messages.eyeDropper,
      hidden: supported ? undefined : true,
      disabled: input.disabled || input.readOnly || undefined,
    }),
    hiddenInput: (): PartProps => ({
      ...part("hidden-input"),
      type: "text",
      id: input.ids.hiddenInput,
      "aria-hidden": "true",
      tabindex: -1,
      name: input.name,
      form: input.form,
      disabled: input.disabled || undefined,
      "data-required": dataFlag(input.required),
      defaultValue: formText(input.defaultValue),
      style: hiddenFormInputStyle,
    }),
    formValue: formText(color),
  }
}
